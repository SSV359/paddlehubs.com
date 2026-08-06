import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.paddlehubs.app',
  appName: 'PaddleHubs',
  webDir: 'dist',
  server: {
    // During local development you can point this at your dev server
    // (e.g. androidScheme: 'http', url: 'http://<your-computer-IP>:3000')
    // to live-reload inside the native shell. For production builds,
    // leave this out entirely — Capacitor bundles the built dist/
    // folder directly into the app, no server needed.
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
