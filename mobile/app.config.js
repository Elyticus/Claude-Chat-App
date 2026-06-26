// Dynamic Expo config so the backend URL is env-switchable.
//
// Defaults point at the Render backend whose service name is `chatloop-server`
// (see ../render.yaml). NOTE: that host must actually be running the CURRENT
// server/ code for the app to work — redeploy via render.yaml if it isn't.
// For local development against the Express server on your LAN, copy
// `.env.example` to `.env` and set EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL
// to your machine's LAN IP (e.g. http://192.168.1.20:4000). Expo loads `.env`
// automatically. `services/api.ts` and `services/socket.ts` read these from
// `Constants.expoConfig.extra`.

const PROD_API = 'https://chatloop-server.onrender.com/api';
const PROD_SOCKET = 'https://chatloop-server.onrender.com';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? PROD_API;
const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL ?? PROD_SOCKET;

module.exports = {
  expo: {
    name: 'Linkloop',
    slug: 'linkloop',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0f172a',
    },
    newArchEnabled: false,
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.yourcompany.linkloop',
      buildNumber: '1',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f172a',
      },
      package: 'com.yourcompany.linkloop',
      versionCode: 1,
    },
    extra: {
      apiUrl,
      socketUrl,
    },
    plugins: ['expo-secure-store'],
  },
};
