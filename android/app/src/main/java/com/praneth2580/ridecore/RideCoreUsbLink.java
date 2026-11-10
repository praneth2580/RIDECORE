package com.praneth2580.ridecore;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.SystemClock;
import com.hoho.android.usbserial.driver.CdcAcmSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * A USB serial line to RIDECORE's handlebar module, read a line at a time on a thread of
 * its own (usb-serial-for-android: CDC boards, CH340, CP210x, FTDI). Lines are handed on
 * a few at a time, every FLUSH_MS, so fifty IMU samples a second don't mean fifty trips
 * to the page; a button's line goes at once.
 */
final class RideCoreUsbLink {

    interface Listener {
        /** Complete lines, without their line ends. On the reading thread. */
        void onLines(List<String> lines);

        /** The line stopped: unplugged, or it failed. On the reading thread. */
        void onClosed(String reason);
    }

    /** What the firmware talks at; boards on their own USB ignore it. */
    static final int BAUD = 115200;
    private static final int READ_TIMEOUT_MS = 100;
    private static final int WRITE_TIMEOUT_MS = 250;
    private static final int FLUSH_MS = 40;
    /** Longer than any message: what isn't a line by then is noise. */
    private static final int MAX_LINE = 1024;

    private final UsbSerialPort port;
    private final Listener listener;
    private final String name;
    private final String deviceName;
    private volatile boolean open = true;
    private Thread reader;

    private RideCoreUsbLink(UsbSerialPort port, String name, String deviceName, Listener listener) {
        this.port = port;
        this.name = name;
        this.deviceName = deviceName;
        this.listener = listener;
    }

    /**
     * The serial driver for a board: the library knows it by its USB ids (CH340, CP210x,
     * FTDI, Arduino, Pico…), else any device with a CDC serial interface (an ESP32-S3's or
     * C3's own USB). Null for anything else on the hub (a memory stick).
     */
    static UsbSerialDriver driverFor(UsbDevice device) {
        UsbSerialDriver driver = UsbSerialProber.getDefaultProber().probeDevice(device);
        if (driver != null) return driver;
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            if (iface.getInterfaceClass() == UsbConstants.USB_CLASS_CDC_DATA) return new CdcAcmSerialDriver(device);
        }
        return null;
    }

    /** Opens the board's serial line; the caller already has USB permission for it. */
    static RideCoreUsbLink open(UsbManager manager, UsbDevice device, Listener listener) throws IOException {
        UsbSerialDriver driver = driverFor(device);
        if (driver == null || driver.getPorts().isEmpty()) throw new IOException("Not a USB serial board");
        UsbDeviceConnection connection = manager.openDevice(device);
        if (connection == null) throw new IOException("USB access not allowed");
        UsbSerialPort port = driver.getPorts().get(0);
        port.open(connection);
        try {
            port.setParameters(BAUD, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);
            // A board on its own USB (CDC) sends once DTR says a terminal is listening
            // (Leonardo, Pico); RTS stays off, as RTS on would hold an ESP32-S3 in reset.
            // Through a USB serial chip they're left off: there DTR resets an Uno or Nano,
            // and on an ESP32 DevKit can leave it in its bootloader after a brown-out.
            boolean cdc = driver instanceof CdcAcmSerialDriver;
            port.setDTR(cdc);
            port.setRTS(false);
        } catch (IOException | UnsupportedOperationException e) {
            // Some chips take no line settings; the data still flows.
        }
        String name = device.getProductName() != null ? device.getProductName() : driver.getClass().getSimpleName().replace("SerialDriver", "");
        RideCoreUsbLink link = new RideCoreUsbLink(port, name, device.getDeviceName(), listener);
        link.start();
        return link;
    }

    String name() {
        return name;
    }

    /** The device's path on the bus, to know it when it's unplugged. */
    String deviceName() {
        return deviceName;
    }

    /** One line to the module. False if it didn't go. */
    synchronized boolean write(String line) {
        if (!open) return false;
        try {
            port.write((line + "\n").getBytes(StandardCharsets.UTF_8), WRITE_TIMEOUT_MS);
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    void close() {
        if (!open) return;
        open = false;
        Thread thread = reader;
        if (thread != null && thread != Thread.currentThread()) {
            try {
                thread.join(READ_TIMEOUT_MS * 3L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        closePort();
    }

    private void closePort() {
        try {
            port.close();
        } catch (IOException ignored) {
            // Already gone with the device.
        }
    }

    private void start() {
        reader = new Thread(this::read, "ridecore-module-usb");
        reader.setDaemon(true);
        reader.start();
    }

    private void read() {
        byte[] buffer = new byte[Math.max(1024, port.getReadEndpoint().getMaxPacketSize())];
        ByteArrayOutputStream partial = new ByteArrayOutputStream(256);
        List<String> pending = new ArrayList<>();
        long lastFlush = SystemClock.elapsedRealtime();
        String reason = null;

        while (open) {
            int count;
            try {
                count = port.read(buffer, READ_TIMEOUT_MS);
            } catch (IOException e) {
                reason = "The module stopped answering";
                break;
            }
            boolean urgent = false;
            for (int i = 0; i < count; i++) {
                byte b = buffer[i];
                if (b == '\n') {
                    String line = partial.toString(StandardCharsets.UTF_8).trim();
                    partial.reset();
                    if (line.isEmpty()) continue;
                    pending.add(line);
                    // A button can't wait for the next batch.
                    if (line.contains("\"t\":\"btn\"")) urgent = true;
                } else if (b != '\r') {
                    if (partial.size() < MAX_LINE) partial.write(b);
                    else partial.reset();
                }
            }

            long now = SystemClock.elapsedRealtime();
            if (!pending.isEmpty() && (urgent || now - lastFlush >= FLUSH_MS)) {
                listener.onLines(pending);
                pending = new ArrayList<>();
                lastFlush = now;
            }
        }

        if (reason != null && open) {
            open = false;
            closePort();
            listener.onClosed(reason);
        }
    }
}
