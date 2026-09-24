import { useQuery } from "@powersync/react";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ChoiceList } from "@/components/choice-list";
import { useAuth } from "@/db/provider";
import {
  acceptInvitation,
  InvitationError,
  type InvitationPreview,
  previewInvitation,
} from "@/features/invitations/api";
import { useInvitation } from "@/features/invitations/provider";
import { useHouseholdAccess } from "@/features/onboarding/access";
import {
  EmailAuthFields,
  useEmailAuth,
} from "@/features/onboarding/email-auth";
import { useOnboarding } from "@/features/onboarding/provider";
import { Field, FormError, FormScreen } from "@/features/profile/form";

export default function JoinHousehold() {
  const { session, ready } = useAuth();
  const invitation = useInvitation();
  return (
    <FormScreen>
      <FormError message={invitation.error} />
      {!ready ? <Text>Loading…</Text> : session && invitation.code
        ? (
          <ChoosePerson
            key={`${invitation.code}:${session.user.id}`}
            code={invitation.code}
            userId={session.user.id}
          />
        )
        : <InviteSignIn />}
    </FormScreen>
  );
}

function CancelInvitation({ disabled = false }: { disabled?: boolean }) {
  const invitation = useInvitation();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <FormError message={error} />
      <Button
        variant="ghost"
        disabled={disabled}
        onPress={() => {
          void invitation.clear().catch(() =>
            setError("Could not close the invitation. Try again.")
          );
        }}
      >
        <Text>Cancel</Text>
      </Button>
    </>
  );
}

function InviteSignIn() {
  const [email, setEmail] = useState("");
  const [codeMode, setCodeMode] = useState(false);
  const auth = useEmailAuth({
    signup: true,
    email,
    onEmail: setEmail,
    initialCode: codeMode,
    onSent: async () => setCodeMode(true),
    onEdit: () => setCodeMode(false),
    onVerified: () => {},
  });
  return (
    <>
      <Text variant="h2">
        {codeMode ? "Check your inbox" : "You’re invited"}
      </Text>
      <Text className="text-muted-foreground">
        {codeMode
          ? `Enter the six-digit code sent to ${email.trim()}.`
          : "Sign in or create an account to join your household. We’ll email you a code."}
      </Text>
      <EmailAuthFields signup state={auth} />
      <Button
        disabled={auth.primaryAction.disabled}
        onPress={auth.primaryAction.onPress}
      >
        <Text>{auth.primaryAction.label}</Text>
      </Button>
      <CancelInvitation disabled={auth.busy} />
    </>
  );
}

function ChoosePerson({ code, userId }: { code: string; userId: string }) {
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [joinedId, setJoinedId] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    previewInvitation(code).then((result) => {
      if (!active) return;
      setPreview(result);
      if (result.joined) setJoinedId(result.list_id);
    }).catch((e: unknown) => {
      if (active) {
        setError(
          e instanceof Error ? e.message : "Could not load the invitation.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [code, attempt]);

  async function join() {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      setJoinedId(
        await acceptInvitation(
          code,
          selected === "new" ? { name: name.trim() } : { person_id: selected },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join. Try again.");
      if (e instanceof InvitationError && e.status === 409) {
        setSelected(null);
        setPreview(null);
        setAttempt((n) => n + 1);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (joinedId) {
    return <OpenJoinedHousehold listId={joinedId} userId={userId} />;
  }
  return (
    <>
      <FormError message={error} />
      {!preview
        ? (
          <>
            {!error ? <Text>Loading invitation…</Text> : (
              <Button
                variant="outline"
                onPress={() => {
                  setError(null);
                  setAttempt((n) => n + 1);
                }}
              >
                <Text>Try again</Text>
              </Button>
            )}
          </>
        )
        : (
          <>
            <Text variant="h2">Join {preview.name}</Text>
            <Text className="text-muted-foreground">
              Share meals, shopping, recipes, and chats with this household.
            </Text>
            <Text variant="h3">Who are you?</Text>
            <View pointerEvents={busy ? "none" : "auto"}>
              <ChoiceList
                selection="single"
                selectedKeys={selected ? [selected] : []}
                choices={[
                  ...preview.people.map((p) => ({ key: p.id, title: p.name })),
                  { key: "new", title: "I’m not listed" },
                ]}
                onSelect={setSelected}
              />
            </View>
            {selected === "new"
              ? (
                <Field
                  label="Your name"
                  autoCapitalize="words"
                  value={name}
                  onChangeText={setName}
                  maxLength={200}
                  editable={!busy}
                />
              )
              : null}
            <Button
              disabled={busy || !selected ||
                (selected === "new" && !name.trim())}
              onPress={() => void join()}
            >
              <Text>{busy ? "Joining…" : "Join household"}</Text>
            </Button>
          </>
        )}
      <CancelInvitation disabled={busy} />
    </>
  );
}

function OpenJoinedHousehold(
  { listId, userId }: { listId: string; userId: string },
) {
  const { syncReady, syncError, retrySync } = useAuth();
  const { switchHousehold } = useHouseholdAccess();
  const { clear: clearInvitation } = useInvitation();
  const { clear: clearDraft } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);
  const { data } = useQuery<{ id: string; user_id: string }>(
    "SELECT l.id, p.user_id FROM lists l JOIN household_profiles h ON h.id = l.id JOIN list_members m ON m.list_id = l.id JOIN household_people p ON p.list_id = l.id AND p.user_id = m.user_id WHERE l.id = ? AND m.user_id = ?",
    [listId, userId],
  );
  const downloaded = syncReady &&
    data.some((row) => row.id === listId && row.user_id === userId);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!downloaded) return;
    let active = true;
    // The destination must exist locally before lifting the invitation gate.
    // Otherwise setup can flash or the previous household can become active.
    void clearDraft().then(async () => {
      if (!active) return;
      switchHousehold(listId);
      await clearInvitation();
    }).catch(() => {
      if (active) {
        setError("You’ve joined, but could not open the household. Try again.");
      }
    });
    return () => {
      active = false;
    };
  }, [
    downloaded,
    listId,
    switchHousehold,
    clearInvitation,
    clearDraft,
    attempt,
  ]);
  return (
    <>
      <Text variant="h2">Opening your household…</Text>
      <Text className="text-muted-foreground">
        You’ve joined. Your shared meals and shopping are downloading.
      </Text>
      <FormError message={error ?? syncError} />
      {slow || error || syncError
        ? (
          <Button
            variant="outline"
            onPress={() => {
              setError(null);
              setAttempt((n) => n + 1);
              retrySync();
            }}
          >
            <Text>Try again</Text>
          </Button>
        )
        : null}
    </>
  );
}
