import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import {
  Avatar, Button, Card, Chip, PageHeader, Screen, Stack, Sticker, Text,
} from '@/components';
import { color } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { api } from '@/lib/api';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';

/**
 * An account — which this app deliberately does not need.
 *
 * Everything on every other screen works with no sign-in and no network: the
 * load model, the forecast, the swap, the planner and the ranking all run on the
 * phone. Signing in adds exactly two things, and the screen says so rather than
 * implying the app was crippled until now — **your week on your other devices**,
 * and **the circle**, which is the one feature that genuinely cannot work alone.
 *
 * So there is no wall, no "create an account to continue", and no upsell. The
 * tab it sits behind is the settings tab, which is where a person goes looking
 * for this and nowhere else.
 */
export default function Account() {
  const router = useRouter();
  const { account, setAccount, goLive, endSession, mode: dataMode } = useStore();

  /** Which form is showing. Distinct from the store's demo/live `mode`. */
  const [form, setForm] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /**
   * Is there actually an API there?
   *
   * Asked rather than assumed. On web the first render happens on the server,
   * where the dev host is not known yet — deciding then would leave the browser
   * permanently showing "on this device" even with a server running on the next
   * port. A health check costs one request and is never wrong.
   */
  const [server, setServer] = useState<'checking' | 'none' | 'ready'>('checking');

  useEffect(() => {
    let live = true;
    void (async () => {
      const health = await api.health();
      if (!live) return;
      if (!health.ok) { setServer('none'); return; }
      setServer('ready');
      // Whoever was signed in last time still is: the session is a cookie the
      // device kept. Restoring it is what stops a reload looking like a sign-out.
      const me = await api.me();
      if (live && me.ok) setAccount(me.data);
    })();
    return () => { live = false; };
  }, [setAccount]);

  /** Straight in. The account is real; it just has no email on it yet. */
  const guest = async () => {
    setBusy(true);
    setProblem(null);
    const res = await api.signInGuest();
    if (!res.ok) {
      setBusy(false);
      setProblem(MESSAGE[res.error] ?? MESSAGE.default);
      return;
    }
    const me = await api.me();
    setBusy(false);
    if (!me.ok) { setProblem(MESSAGE.default); return; }
    goLive(me.data, new Date().toISOString().slice(0, 10));
    successFeedback();
  };

  const submit = async () => {
    setBusy(true);
    setProblem(null);
    const res = form === 'up'
      ? await api.signUp(name.trim(), email.trim().toLowerCase(), password)
      : await api.signIn(email.trim().toLowerCase(), password);

    if (!res.ok) {
      setBusy(false);
      setProblem(MESSAGE[res.error] ?? MESSAGE.default);
      return;
    }
    const me = await api.me();
    setBusy(false);
    if (!me.ok) { setProblem(MESSAGE.default); return; }

    /*
     * The moment the app stops being a demo.
     *
     * Everything seeded goes and today becomes today. Keeping Amira's week under
     * a real person's name would be worse than useless - they would add a task
     * to somebody else's semester and the battery would read her load, not
     * theirs.
     */
    goLive(me.data, new Date().toISOString().slice(0, 10));
    setPassword('');
    successFeedback();
  };

  const signOut = async () => {
    tapFeedback();
    await api.signOut();
    // Signed out is the sign-in screen: nothing here works without an account.
    endSession();
    router.replace('/welcome');
  };

  /* ------------------------------------------------------- no server built */

  if (server === 'checking') {
    return (
      <Screen back="/you" backLabel="You">
        <Stack gap={5} className="pt-2">
          <PageHeader {...SCREEN.you} eyebrow="Account" title="One moment" />
          <Card tone="sunken" gap={2}>
            <Text variant="callout" tone="muted">Looking for your server…</Text>
          </Card>
        </Stack>
      </Screen>
    );
  }

  if (server === 'none') {
    return (
      <Screen back="/you" backLabel="You">
        <Stack gap={5} className="pt-2">
          <PageHeader {...SCREEN.you} eyebrow="Account" title="On this device" />
          <Card tone="sunken" gap={3}>
            <Stack direction="row" gap={4} align="center">
              <Sticker name="cloud" size={34} />
              <Text variant="callout" tone="muted" className="flex-1">
                This build has no server configured, so everything lives on this phone.
              </Text>
            </Stack>
            <Text variant="footnote" tone="subtle">
              Which is how the whole app works anyway. Nothing here is waiting on one.
            </Text>
          </Card>
        </Stack>
      </Screen>
    );
  }

  /* ---------------------------------------------------------- signed in */

  /*
   * Already in? This screen has nothing left to say.
   *
   * The profile and the settings screen own everything about an account now, so
   * landing here signed in means you took a stale route - go where you meant to
   * rather than showing a second, worse version of the profile.
   */
  if (account) {
    return (
      <Screen back="/you" backLabel="You">
        <Stack gap={5} className="pt-2">
          <PageHeader {...SCREEN.you} eyebrow="Signed in" title={account.name} />
          <Card tone="steady" gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Avatar initials={account.initials} size={56} band="steady" />
              <Stack gap={1} grow>
                <Text variant="body" weight="semibold">{account.email}</Text>
                <Text variant="micro" tone="subtle">
                  {dataMode === 'live' ? 'Your own week, syncing.' : 'Signed in.'}
                </Text>
              </Stack>
            </Stack>
          </Card>
          <Stack direction="row" gap={3}>
            <Button label="Your profile" onPress={() => router.replace('/you')} className="flex-1" />
            <Button label="Settings" kind="secondary" onPress={() => router.replace('/settings')} className="flex-1" />
          </Stack>
        </Stack>
      </Screen>
    );
  }

  /* --------------------------------------------------------- signed out */

  // Signing in and making an account live on the welcome screen now.
  if (!account) return <Redirect href="/welcome" />;

  const ready = email.includes('@') && password.length >= 8 && (form === 'in' || name.trim().length > 0);

  return (
    <Screen
      back="/you"
      backLabel="You"
      footer={
        <Button
          label={busy ? 'One moment…' : form === 'up' ? 'Create account' : 'Sign in'}
          kind={ready && !busy ? 'primary' : 'secondary'}
          accessibilityState={{ disabled: !ready || busy }}
          onPress={() => { if (ready && !busy) void submit(); }}
        />
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader
          {...SCREEN.you}
          eyebrow="Optional"
          title={form === 'up' ? 'Make an account' : 'Sign in'}
        />

        {/*
          What it buys, before what it costs.
          
          Two rows with a picture each, because "why would I make an account" is
          the only question on this screen and a paragraph does not answer it as
          fast as two icons do.
        */}
        <Stack gap={3}>
          {[
            { sticker: 'people' as const, wash: color.decor.candy, title: 'See your friends\u2019 batteries', sub: 'Who has room left, and when you are both free.' },
            { sticker: 'calendar' as const, wash: color.decor.sky, title: 'Your week on every device', sub: 'Phone, laptop, tablet. Offline edits catch up later.' },
          ].map((row) => (
            <Stack key={row.title} direction="row" gap={4} align="center" className="min-h-row rounded-lg border-2 border-line-hairline bg-raised px-4 py-4">
              <View className="items-center justify-center rounded-pill" style={{ width: 44, height: 44, backgroundColor: row.wash }}>
                <Sticker name={row.sticker} size={28} />
              </View>
              <Stack gap={1} grow>
                <Text variant="body" weight="semibold">{row.title}</Text>
                <Text variant="micro" tone="muted">{row.sub}</Text>
              </Stack>
            </Stack>
          ))}
        </Stack>

        {/*
          One tap, first.
          
          Above the form on purpose: for somebody trying this for ninety seconds
          it is the only sensible path, and burying it under two text fields is
          how demos lose people.
        */}
        <Stack gap={3}>
          <Button
            label={busy ? 'One moment…' : 'Continue as guest'}
            onPress={() => { if (!busy) void guest(); }}
          />
          <Text variant="micro" tone="subtle" className="text-center">
            A real account with no email. Add one later and keep everything.
          </Text>
        </Stack>

        <Stack direction="row" gap={3} align="center">
          <View className="h-px flex-1 bg-line-hairline" />
          <Text variant="micro" tone="subtle">or use an email</Text>
          <View className="h-px flex-1 bg-line-hairline" />
        </Stack>

        {/* A segmented control, because two mutually exclusive modes always are one. */}
        <Stack direction="row" gap={0} className="rounded-pill border-2 border-line-strong bg-sunken p-1">
          {(['in', 'up'] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected: form === option }}
              accessibilityLabel={option === 'in' ? 'Sign in' : 'Create an account'}
              onPress={() => { tapFeedback(); setForm(option); setProblem(null); }}
              className={`min-h-min flex-1 items-center justify-center rounded-pill py-3 active:opacity-70 ${
                form === option ? 'bg-inverse' : ''
              }`}
            >
              <Text variant="caption" weight="bold" tone={form === option ? 'inverse' : 'muted'}>
                {option === 'in' ? 'Sign in' : 'Create account'}
              </Text>
            </Pressable>
          ))}
        </Stack>

        <Card gap={4}>
          {form === 'up' ? (
            <Field label="YOUR NAME" value={name} onChange={setName} placeholder="Amira Hassan" autoComplete="name" />
          ) : null}
          <Field
            label="EMAIL"
            value={email}
            onChange={setEmail}
            placeholder="you@university.edu"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label="PASSWORD"
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
            autoComplete={form === 'up' ? 'new-password' : 'current-password'}
            secure
          />
          {problem ? (
            <Text variant="footnote" tone="heavy" accessibilityLiveRegion="polite">{problem}</Text>
          ) : null}
        </Card>

        <Card tone="sunken" gap={2}>
          <Stack direction="row" gap={3} align="center">
            <Sticker name="heart" size={26} />
            <Text variant="footnote" weight="semibold" className="flex-1">
              You do not need an account. The app already works.
            </Text>
          </Stack>
          <Text variant="micro" tone="muted">
            We send no email and post nothing. The address is a login, nothing else.
          </Text>
        </Card>

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

/** One labelled input, in the app's own style rather than a platform default. */
function Field({
  label, value, onChange, placeholder, autoComplete, keyboardType, secure,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  autoComplete?: 'name' | 'email' | 'new-password' | 'current-password';
  keyboardType?: 'email-address';
  secure?: boolean;
}) {
  return (
    <Stack gap={2}>
      <Text variant="micro" tone="subtle">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.ink.subtle}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        accessibilityLabel={label}
        className="min-h-row rounded-md border-2 border-line-hairline bg-decor-cream px-4 py-3 text-body text-ink-default"
      />
    </Stack>
  );
}

/** Plain words for the handful of things that actually go wrong. */
const MESSAGE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'That email and password do not match.',
  USER_ALREADY_EXISTS: 'There is already an account with that address. Try signing in.',
  offline: 'No connection. Your week is safe on this phone either way.',
  timeout: 'The server took too long. Try again in a moment.',
  default: 'That did not work. Try again.',
};
