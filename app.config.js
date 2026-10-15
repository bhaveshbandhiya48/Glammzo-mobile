const fs = require("fs")
const path = require("path")

/** @type {import('expo/config').ExpoConfig} */
/** Shared fallback, or set platform-specific keys (recommended). */
const mapsApiKeyShared =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ""
const mapsApiKeyIos =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY?.trim() || mapsApiKeyShared
const mapsApiKeyAndroid =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
  mapsApiKeyShared
const siteUrl = (
  process.env.EXPO_PUBLIC_SITE_URL?.trim() || "https://glammzo.com"
).replace(/\/$/, "")

/** Required for Android remote push (FCM). Download from Firebase Console. */
const googleServicesPath = path.join(__dirname, "google-services.json")
const googleServicesFile = fs.existsSync(googleServicesPath)
  ? "./google-services.json"
  : undefined

const config = {
  name: "Glammzo",
  slug: "glammzo-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "glammzo",
  userInterfaceStyle: "light",
  splash: {
    // Solid brand color only — logo splash removed; JS shows splash.mp4.
    image: "./assets/splash-blank.png",
    resizeMode: "contain",
    backgroundColor: "#F6F4F1",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.glammzo.mobile",
    buildNumber: "1",
    ...(mapsApiKeyIos
      ? {
          config: {
            googleMapsApiKey: mapsApiKeyIos,
          },
        }
      : {}),
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#F6F4F1",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    package: "com.glammzo.mobile",
    ...(googleServicesFile ? { googleServicesFile } : {}),
    ...(mapsApiKeyAndroid
      ? {
          config: {
            googleMaps: {
              apiKey: mapsApiKeyAndroid,
            },
          },
        }
      : {}),
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-image",
    "expo-status-bar",
    "expo-secure-store",
    "expo-sharing",
    "expo-video",
    "@react-native-community/datetimepicker",
    [
      "react-native-maps",
      {
        ...(mapsApiKeyAndroid
          ? { androidGoogleMapsApiKey: mapsApiKeyAndroid }
          : {}),
        ...(mapsApiKeyIos ? { iosGoogleMapsApiKey: mapsApiKeyIos } : {}),
      },
    ],
    [
      "expo-splash-screen",
      {
        // Solid cream only — splash-blank.png is already brand bg (no logo).
        // Do not set imageWidth: 1; jimp fails resize during prebuild.
        backgroundColor: "#F6F4F1",
        image: "./assets/splash-blank.png",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#F95C48",
        defaultChannel: "glammzo-default",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Allow Glammzo to use your location to find salons near you.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "ed265c2c-9a78-4090-bd45-e34cda51201b",
    },
    googleMapsApiKey: mapsApiKeyIos || mapsApiKeyAndroid || mapsApiKeyShared,
    googleMapsApiKeyIos: mapsApiKeyIos,
    googleMapsApiKeyAndroid: mapsApiKeyAndroid,
    legal: {
      siteUrl,
      privacyUrl: `${siteUrl}/privacy`,
      termsUrl: `${siteUrl}/terms`,
      cancellationUrl: `${siteUrl}/cancellation-policy`,
      deleteAccountUrl: `${siteUrl}/delete-account`,
      supportEmail: "hello@glammzo.com",
    },
  },
}

module.exports = { expo: config }
