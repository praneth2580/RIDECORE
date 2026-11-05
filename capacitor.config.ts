import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.praneth2580.ridecore',
  appName: 'RIDECORE',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    // OpenFreeMap asks apps that save maps offline to name themselves.
    appendUserAgent: 'RIDECORE',
  },
  plugins: {
    Geolocation: {
      // High-accuracy GPS preferred for motorcycle navigation prototypes.
    },
  },
};

export default config;
