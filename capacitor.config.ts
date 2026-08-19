import type { CapacitorConfig } from '@capacitor/cli';

// Phase 6 — Mobile (Capacitor): wraps the same Vue app (PRD §3, §10)
const config: CapacitorConfig = {
  appId: 'app.biblestudy.mobile',
  appName: 'Bible Study',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  ios: {
    minVersion: '16.0',
    contentInset: 'automatic'
  },
  android: {
    minSdkVersion: 29 // Android 10
  },
  plugins: {
    StatusBar: {
      style: 'DEFAULT',
      overlaysWebView: false
    }
  }
};

export default config;
