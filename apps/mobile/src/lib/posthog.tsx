import Constants from "expo-constants";
import { useSegments } from "expo-router";
import PostHog, { PostHogProvider } from "posthog-react-native";
import { useEffect, type PropsWithChildren } from "react";

type PostHogExtra = {
  posthogProjectToken?: string;
  posthogHost?: string;
};

const extra = Constants.expoConfig?.extra as PostHogExtra | undefined;
const projectToken = extra?.posthogProjectToken;
const host = extra?.posthogHost;

if (!projectToken && __DEV__) {
  throw new Error(
    "EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}

if (!host && __DEV__) {
  throw new Error(
    "EXPO_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_HOST is configured",
  );
}

export const posthog =
  projectToken && host
    ? new PostHog(projectToken, {
        host,
        enableSessionReplay: true,
        // Replays are only useful if we can read the chat. Mask secrets
        // per view with PostHogMaskView.
        sessionReplayConfig: {
          maskAllTextInputs: false,
          maskAllImages: false,
        },
        logs: {
          serviceName: "estra-mobile",
          environment: __DEV__ ? "development" : "production",
          serviceVersion: Constants.expoConfig?.version,
        },
        errorTracking: {
          autocapture: {
            uncaughtExceptions: true,
            unhandledRejections: true,
            console: [],
          },
        },
      })
    : null;

// Route pattern, not pathname: "/chats/[id]" groups every chat as one screen.
function useScreenTracking() {
  const screen =
    "/" +
    useSegments()
      .filter((segment) => !segment.startsWith("("))
      .join("/");

  useEffect(() => {
    void posthog?.screen(screen);
  }, [screen]);
}

export function PostHogRoot({ children }: PropsWithChildren) {
  useScreenTracking();

  if (!posthog) {
    return children;
  }

  // expo-router hides the NavigationContainer that screen autocapture needs;
  // useScreenTracking covers it.
  return (
    <PostHogProvider client={posthog} autocapture={{ captureScreens: false }}>
      {children}
    </PostHogProvider>
  );
}
