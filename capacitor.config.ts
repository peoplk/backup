import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.focusflow.app',
  appName: 'FocusFlow',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: true,
    url: undefined,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
