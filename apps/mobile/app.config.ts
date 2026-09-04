import type { ExpoConfig } from "expo/config";

/**
 * APP_ENV selects which backend the build points at and keeps the three
 * variants installable side by side on one device (distinct bundle ids).
 *   local -> supabase start + docker compose (this machine / tailnet)
 *   dev   -> hosted dev project
 *   prod  -> production
 */
type AppEnv = "local" | "dev" | "prod";
const APP_ENV = (process.env.APP_ENV ?? "local") as AppEnv;

const variants: Record<AppEnv, { name: string; idSuffix: string }> = {
  local: { name: "Estra (Local)", idSuffix: ".local" },
  dev: { name: "Estra (Dev)", idSuffix: ".dev" },
  prod: { name: "Estra", idSuffix: "" },
};

const variant = variants[APP_ENV];

const config: ExpoConfig = {
  name: variant.name,
  slug: "estra",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "estra",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./assets/expo.icon",
    bundleIdentifier: `com.estra.app${variant.idSuffix}`,
    supportsTablet: true,
    // local/dev point at plain-HTTP backends (supabase start, docker PowerSync,
    // Tailscale IP). ATS blocks those without this exception. Prod is https.
    infoPlist:
      APP_ENV === "prod"
        ? undefined
        : {
            NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
          },
  },
  android: {
    package: `com.estra.app${variant.idSuffix}`,
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        cameraPermission:
          "Put what you have on the table and take a picture to get some ideas.",
        photosPermission: "Pick a photo of what you have to get some ideas.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appEnv: APP_ENV,
  },
};

export default config;
