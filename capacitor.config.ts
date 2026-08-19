import type { CapacitorConfig } from '@capacitor/cli';

// Phase 6 — Mobile (Capacitor): wraps the same Vue app (PRD §3, §10)
const config: CapacitorConfig = {
  appId: 'app.biblestudy.mobile',
  appName: 'Bible Study',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    // Local dev: point the native WebView at the Vite dev server so API
    // calls from within the app reach http://localhost:58128 on the host
    // machine.  Remove (or guard with an env check) before a production build.
    //
    // iOS simulator — localhost resolves to the Mac, so this works as-is.
    // Android emulator — use 10.0.2.2 (emulator alias for host loopback).
    url: 'http://localhost:5173'
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
