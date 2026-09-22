import { Image } from "expo-image";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Keyboard,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PreviousQuestionButton } from "@/features/onboarding/previous-question-button";
import { useAuth } from "@/db/provider";
import { FormError } from "@/features/profile/form";
import { steps, type Step } from "@/features/onboarding/draft";
import {
  EmailAuthFields,
  useEmailAuth,
} from "@/features/onboarding/email-auth";
import { useOnboarding } from "@/features/onboarding/provider";
import {
  artByStep,
  SetupQuestion,
  subtitles,
  titles,
} from "@/features/onboarding/setup-question";

export function SetupFlow() {
  const { draft } = useOnboarding();
  if (!draft) return <Redirect href="/setup" />;
  return <Questions initialStep={draft.step} />;
}

function Questions({ initialStep }: { initialStep: Step }) {
  const { draft, update, error } = useOnboarding();
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const reduced = useReducedMotion();
  const pager = useRef<ScrollView>(null);
  const moving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const [index, setIndex] = useState(() => steps.indexOf(initialStep));
  const [settledIndex, setSettledIndex] = useState(index);
  const [initialOffset] = useState(() => ({ x: index * width, y: 0 }));
  const step = steps[index];

  // Content moves within this route; the surrounding controls never page.
  useEffect(() => {
    pager.current?.scrollTo({ x: index * width, animated: !reduced });
  }, [index, width, reduced]);

  const move = useCallback(
    async (target: number) => {
      const targetStep = steps[target];
      if (moving.current || !targetStep) return;
      moving.current = true;
      Keyboard.dismiss();
      try {
        await update((d) => ({ ...d, step: targetStep }));
        setIndex(target);
        if (reduced) setSettledIndex(target);
        AccessibilityInfo.announceForAccessibility(
          `${titles[targetStep]}. Question ${target + 1} of ${session ? 9 : steps.length}.`,
        );
      } finally {
        moving.current = false;
      }
    },
    [update, session, reduced],
  );

  const auth = useEmailAuth({
    signup: true,
    email: draft?.email ?? "",
    onEmail: (email) => void update((d) => ({ ...d, email })).catch(() => {}),
    initialCode: step === "code",
    onSent: async () => {
      if (step !== "code") await move(steps.indexOf("code"));
    },
    onEdit: () => void move(steps.indexOf("email")).catch(() => {}),
    onVerified: () => router.replace("/setup" as never),
  });

  const previous = useCallback(() => {
    if (index > 0 && !moving.current && !auth.busy) {
      void move(index - 1).catch(() => {});
    }
    if (index === 0 && !moving.current && !auth.busy) {
      router.back();
    }
  }, [index, auth.busy, move, router]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          // At the first question Android Back returns to Welcome.
          if (index === 0) return false;
          previous();
          return true;
        },
      );
      return () => subscription.remove();
    }, [index, previous]),
  );

  if (!draft) return null;
  const person = draft.people.find((p) => p.id === draft.onboarding_person_id)!;
  const valid =
    (step !== "name" || !!person.name.trim()) &&
    (step !== "diet" || person.diet !== "other" || !!person.diet_other.trim());
  const isAuth = step === "email" || step === "code";
  const finishing = !!session && (step === "fresh" || isAuth);
  const locked = busy || auth.busy;
  // The content ends at the next reachable question. A flick cannot skip
  // required answers, send an email, verify a code, or finish setup.
  const lastReachable = index + (valid && !isAuth && !finishing ? 1 : 0);
  // Keep the departing page mounted until a button-driven slide settles.
  const pages = steps.slice(0, Math.max(lastReachable, settledIndex) + 1);

  async function next() {
    if (moving.current || locked || !valid) return;
    if (finishing) {
      moving.current = true;
      setBusy(true);
      try {
        await update((d) => ({ ...d, step: "email" }));
        router.replace("/setup" as never);
      } catch {
        // The provider displays the storage error; retain this question.
      } finally {
        moving.current = false;
        setBusy(false);
      }
    } else {
      await move(index + 1).catch(() => {});
    }
  }

  const action =
    isAuth && !session
      ? auth.primaryAction
      : {
          label: busy
            ? "Saving…"
            : finishing
              ? "Finish setup"
              : step === "restrictions" && !draft.profile.restrictions.trim()
                ? "No restrictions"
                : "Continue",
          disabled: !valid,
          onPress: () => void next(),
        };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <View className="flex-1">
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          disableIntervalMomentum
          snapToInterval={width}
          decelerationRate="fast"
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!locked}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentOffset={initialOffset}
          onMomentumScrollEnd={(event) => {
            const target = Math.round(
              event.nativeEvent.contentOffset.x / width,
            );
            if (target === index) {
              setSettledIndex(index);
              return;
            }
            if (
              moving.current ||
              locked ||
              target < 0 ||
              target > lastReachable
            ) {
              pager.current?.scrollTo({ x: index * width, animated: !reduced });
              return;
            }
            void move(target)
              .then(() => setSettledIndex(target))
              .catch(() => {
                pager.current?.scrollTo({
                  x: index * width,
                  animated: !reduced,
                });
              });
          }}
        >
          {pages.map((pageStep, pageIndex) => {
            const art = artByStep[pageStep];
            const authPage = pageStep === "email" || pageStep === "code";
            return (
              <ScrollView
                key={pageStep}
                style={{ width }}
                contentContainerClassName="flex-grow gap-6 px-6"
                contentContainerStyle={{
                  paddingTop: insets.top + 18,
                  paddingBottom: footerHeight + 24,
                }}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                contentInsetAdjustmentBehavior="never"
                pointerEvents={pageIndex === index ? "auto" : "none"}
                accessibilityElementsHidden={pageIndex !== index}
                importantForAccessibility={
                  pageIndex === index ? "auto" : "no-hide-descendants"
                }
              >
                <Text
                  accessibilityRole="progressbar"
                  accessibilityLabel="Setup progress"
                  accessibilityValue={{
                    min: 1,
                    max: session ? 9 : steps.length,
                    now: Math.min(pageIndex + 1, session ? 9 : steps.length),
                  }}
                  className="self-end text-sm text-muted-foreground"
                >
                  {Math.min(pageIndex + 1, session ? 9 : steps.length)} of{" "}
                  {session ? 9 : steps.length}
                </Text>
                <View className="gap-2">
                  <Text
                    accessibilityRole="header"
                    className="text-[28px] font-bold leading-[34px] tracking-tight"
                  >
                    {titles[pageStep]}
                  </Text>
                  <Text className="text-base leading-6 text-muted-foreground">
                    {authPage
                      ? session
                        ? "Your cooking setup is ready to save."
                        : pageStep === "code"
                          ? `Enter the six-digit code sent to ${draft.email.trim() || "your email"}.`
                          : "We’ll email you a six-digit code. No passwords to remember."
                      : subtitles[pageStep]}
                  </Text>
                </View>
                {art ? (
                  <View
                    className="overflow-hidden rounded-2xl border border-border"
                    style={{ borderCurve: "continuous" }}
                  >
                    <Image
                      source={art.source}
                      accessibilityLabel={art.accessibilityLabel}
                      contentFit="cover"
                      style={{
                        width: "100%",
                        aspectRatio: art.aspectRatio ?? 2,
                      }}
                    />
                  </View>
                ) : null}
                {authPage ? (
                  !session ? (
                    <EmailAuthFields
                      signup
                      state={{ ...auth, codeMode: pageStep === "code" }}
                    />
                  ) : null
                ) : (
                  <SetupQuestion step={pageStep} onNext={() => void next()} />
                )}
              </ScrollView>
            );
          })}
        </ScrollView>
        <View
          pointerEvents="box-none"
          className="absolute bottom-0 left-0 right-0 gap-3 px-6 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 14) }}
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        >
          <FormError message={error} />
          <View
            className={
              fontScale > 1.3 ? "gap-3" : "flex-row items-center gap-3"
            }
          >
            <View
              className="min-h-14 min-w-14 items-center justify-center"
              pointerEvents={"auto"}
              importantForAccessibility={"auto"}
            >
              <PreviousQuestionButton disabled={locked} onPress={previous} />
            </View>
            <Button
              className={
                fontScale > 1.3
                  ? "h-auto min-h-14 rounded-full"
                  : "h-auto min-h-14 flex-1 rounded-full"
              }
              disabled={locked || action.disabled}
              onPress={action.onPress}
            >
              <Text className="shrink text-center text-[17px] font-semibold">
                {action.label}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
