const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")

const config = getDefaultConfig(__dirname)

/**
 * expo-secure-store publishes `"browser": "web-stub.js"` (localStorage).
 * Metro defaults to [react-native, browser, main] — with no react-native
 * entry, native bundles pick the web stub and OTP crashes on device.
 * Prefer `main` before `browser` on native; keep browser first for web.
 */
const defaultFields = config.resolver.resolverMainFields ?? [
  "react-native",
  "browser",
  "main",
]
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "expo-secure-store" && platform !== "web") {
    return {
      type: "sourceFile",
      filePath: path.resolve(
        __dirname,
        "node_modules/expo-secure-store/build/SecureStore.js",
      ),
    }
  }
  // Prefer package "main" over "browser" for native so other libs don't
  // accidentally resolve web stubs either.
  if (platform !== "web") {
    return context.resolveRequest(
      {
        ...context,
        mainFields: ["react-native", "main", "browser"],
      },
      moduleName,
      platform,
    )
  }
  return context.resolveRequest(
    { ...context, mainFields: defaultFields },
    moduleName,
    platform,
  )
}

module.exports = config
