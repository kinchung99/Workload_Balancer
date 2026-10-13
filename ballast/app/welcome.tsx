import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Button, Mascot, Screen, Stack, Sticker, Text, type StickerName } from '@/components';
import { color, radius } from '@design/tokens';
import { api, hasServer } from '@/lib/api';
import { guestAllowed } from '@/lib/access';
import { localISO } from '@/lib/marking';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';

/** Three reasons, as pictures with a few words each. */
const WHY: Array<{ sticker: StickerName; wash: string; title: string; sub: string }> = [
  { sticker: 'battery', wash: color.decor.mint, title: 'Your week as a battery', sub: 'Hours × how draining' },
  { sticker: 'star', wash: color.decor.lemon, title: 'What to do first', sub: 'Ranked, with the reason' },
  { sticker: 'people', wash: color.decor.candy, title: 'Time with friends', sub: 'See who’s free, never their tasks' },
];

/** Plain words for the handful of things that actually go wrong. */
const MESSAGE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'That email and password do not match.',
  USER_ALREADY_EXISTS: 'There is already an account with that email. Sign in instead.',
  offline: 'No connection. Try again when you are online.',
  timeout: 'The server took too long. Try again in a moment.',
  default: 'That did not work. Try again.',
};

/**
 * Welcome - sign in or make an account.
 *
 * Everything in Ballast belongs to somebody: a week, a circle, a battery. So the
 * app opens here, with what it does in three pictures and one form. A new
 * account goes on to set up - timetable, tasks, friends - and a returning one
 * goes straight to its week. Preview builds also offer the sample week as a
 * guest; a real build does not.
 */
export default function Welcome() {
  const router = useRouter();
  const { goLive, startGuest, account } = useStore();
  // Set while this screen signs someone in, so the effect below leaves that to it.
  const own = useRef(false);

  // Already signed in - a session restored after this screen opened: go to the week.
  useEffect(() => {
    if (account && !own.current) router.replace('/');
  }, [account, router]);
  const [form, setForm] = useState<'up' | 'in'>('up');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const server = hasServer();

  const ready = email.includes('@') && password.length >= 8 && (form === 'in' || name.trim().length > 0);

  const submit = async () => {
    if (!ready || busy) return;
    own.current = true;
    setBusy(true);
    setProblem(null);
    const res = form === 'up'
      ? await api.signUp(name.trim(), email.trim().toLowerCase(), password)
      : await api.signIn(email.trim().toLowerCase(), password);
    if (!res.ok) {
      own.current = false;
      setBusy(false);
      setProblem(MESSAGE[res.error] ?? MESSAGE.default);
      return;
    }
    const me = await api.me();
    setBusy(false);
    if (!me.ok) { own.current = false; setProblem(MESSAGE.default); return; }
    goLive(me.data, localISO());
    setPassword('');
    successFeedback();
    // A new account sets up; a returning one goes straight to its week.
    router.replace((form === 'up' ? '/setup/timetable' : '/') as Href);
  };

  const asGuest = () => {
    tapFeedback();
    startGuest();
    router.replace('/setup/timetable' as Href);
  };

  return (
    <Screen
      footer={
        server ? (
          <Button
            label={busy ? 'One moment…' : form === 'up' ? 'Create account' : 'Sign in'}
            kind={ready && !busy ? 'primary' : 'secondary'}
            accessibilityState={{ disabled: !ready || busy }}
            onPress={() => void submit()}
          />
        ) : (
          <Button label="Look around as a guest" onPress={asGuest} />
        )
      }
    >
      <Stack gap={5} className="pt-2">
        {/* The battery, the name, the one line. */}
        <View className="items-center gap-2 overflow-hidden px-4 pb-5 pt-6" style={{ borderRadius: radius.xl, backgroundColor: color.decor.lemon }}>
          <Mascot charge={72} loadPercent={28} size={112} />
          <Text variant="display" accessibilityRole="header">Ballast</Text>
          <Text variant="callout" weight="semibold">Plan your week around your energy.</Text>
        </View>

        <Stack gap={2}>
          {WHY.map((row) => (
            <Stack key={row.title} direction="row" gap={3} align="center" className="rounded-lg border border-line-hairline bg-raised px-3 py-2">
              <View className="items-center justify-center rounded-pill" style={{ width: 40, height: 40, backgroundColor: row.wash }}>
                <Sticker name={row.sticker} size={26} />
              </View>
              <Stack gap={0} grow>
                <Text variant="body" weight="semibold">{row.title}</Text>
                <Text variant="micro" tone="muted">{row.sub}</Text>
              </Stack>
            </Stack>
          ))}
        </Stack>

        {server ? (
          <Stack gap={4}>
            {/* Two mutually exclusive forms are one segmented control. */}
            <Stack direction="row" gap={0} accessibilityRole="tablist" className="rounded-pill border-2 border-line-strong bg-sunken p-1">
              {(['up', 'in'] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: form === option }}
                  accessibilityLabel={option === 'up' ? 'Create account' : 'Sign in'}
                  onPress={() => { tapFeedback(); setForm(option); setProblem(null); }}
                  className={`min-h-min flex-1 items-center justify-center rounded-pill py-3 active:opacity-70 ${form === option ? 'bg-inverse' : ''}`}
                >
                  <Text variant="caption" weight="bold" tone={form === option ? 'inverse' : 'muted'}>
                    {option === 'up' ? 'Create account' : 'Sign in'}
                  </Text>
                </Pressable>
              ))}
            </Stack>

            <Stack gap={3}>
              {form === 'up' ? (
                <Field label="Your name" value={name} onChange={setName} autoComplete="name" />
              ) : null}
              <Field label="Email" value={email} onChange={setEmail} autoComplete="email" keyboardType="email-address" />
              <Field
                label="Password · 8+ characters"
                value={password}
                onChange={setPassword}
                autoComplete={form === 'up' ? 'new-password' : 'current-password'}
                secure
                onSubmit={() => void submit()}
              />
              {problem ? <Text variant="footnote" tone="heavy" accessibilityLiveRegion="polite">{problem}</Text> : null}
            </Stack>
          </Stack>
        ) : null}

        {/* Preview builds only: the sample week, no account. */}
        {server && guestAllowed() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Look around as a guest"
            onPress={asGuest}
            className="min-h-min items-center justify-center gap-1 py-2 active:opacity-60"
          >
            <Text variant="callout" weight="semibold" className="underline">Look around as a guest</Text>
            <Text variant="micro" tone="subtle">Sample week · preview only</Text>
          </Pressable>
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

function Field({
  label, value, onChange, autoComplete, keyboardType, secure, onSubmit,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete?: 'name' | 'email' | 'new-password' | 'current-password';
  keyboardType?: 'email-address';
  secure?: boolean;
  onSubmit?: () => void;
}) {
  // A password can be shown to check it was typed right, then hidden again.
  const [hidden, setHidden] = useState(true);
  return (
    <View className="justify-center">
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={color.ink.subtle}
        autoCapitalize={autoComplete === 'name' ? 'words' : 'none'}
        autoCorrect={false}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        secureTextEntry={secure && hidden}
        onSubmitEditing={onSubmit}
        accessibilityLabel={label}
        className={`min-h-row rounded-pill border-2 border-line-hairline bg-sunken py-3 pl-5 text-body text-ink-default ${secure ? '' : 'pr-5'}`}
        // Room on the right for the Show button, so typing never runs under it.
        style={[Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null, secure ? { paddingRight: 92 } : null]}
      />
      {secure ? <Reveal hidden={hidden} onPress={() => { tapFeedback(); setHidden(!hidden); }} /> : null}
    </View>
  );
}

/** The show / hide switch inside a password box. */
function Reveal({ hidden, onPress }: { hidden: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
      onPress={onPress}
      hitSlop={8}
      className="absolute right-3 min-h-min items-center justify-center rounded-pill px-3 active:opacity-60"
    >
      <Text variant="caption" weight="bold" tone="muted">{hidden ? '👁 Show' : '🙈 Hide'}</Text>
    </Pressable>
  );
}
