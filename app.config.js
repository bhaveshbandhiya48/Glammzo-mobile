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
    infoPlist: {
      // HTTPS + Keychain only — skips App Store Connect export-compliance prompt.
      ITSAppUsesNonExemptEncryption: false,
      // Lets the in-app payment screen find installed UPI apps.
      LSApplicationQueriesSchemes: ["tez", "phonepe", "paytmmp", "bhim", "credpay"],
    },
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
      // Match wordmark icon (white + coral on black) — not cream, which looked like a white bg.
      backgroundColor: "#000000",
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
      // SDK 58 enables R8 minify; WorkManager (via notifications) needs these
      // constructors or Android release builds crash before JS loads.
      "expo-build-properties",
      {
        android: {
          extraProguardRules: [
            "-keep class * extends androidx.room.RoomDatabase { <init>(); }",
            "-keep class * extends androidx.work.InputMerger { <init>(); }",
            "-keepclassmembers class * extends androidx.room.RoomDatabase { <init>(); }",
            "-keepclassmembers class * extends androidx.work.InputMerger { <init>(); }",
            // Razorpay's checkout talks to its web view through these.
            "-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }",
            "-keepattributes JavascriptInterface,*Annotation*",
            "-dontwarn com.razorpay.**",
            "-keep class com.razorpay.** { *; }",
            "-keepclasseswithmembers class * { public void onPayment*(...); }",
          ].join("\n"),
        },
      },
    ],
    [
      "expo-image-picker",
      {
        // Library only — do not declare NSCameraUsageDescription (Guideline 5.1.1).
        photosPermission: "Glammzo needs photo access so you can add photos to your reviews.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
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
      supportEmail: "support@glammzo.com",
    },
  },
}

module.exports = { expo: config }
