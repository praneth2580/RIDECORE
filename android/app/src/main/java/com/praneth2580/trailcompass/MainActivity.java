package com.praneth2580.trailcompass;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(com.praneth2580.ridecore.RideCoreDevicePlugin.class); // RIDECORE (ridecore/README.md)
        // Plugins in this app (not from npm) are registered before the bridge starts.
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(DownloadsPlugin.class);
        registerPlugin(MapFilesPlugin.class);
        registerPlugin(RideLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
