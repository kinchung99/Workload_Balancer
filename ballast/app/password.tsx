import { useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Burst, Button, PageHeader, Screen, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import { api } from '@/lib/api';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';

const MIN = 8;
const inputStyle = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : undefined;

/**
 * Change your password.
 *
 * The current one first - a phone left unlocked on a library desk should not
 * be enough to take an account over. Changing it signs out every other device
 * and keeps this one signed in, so a password you think was seen is a
 * password that stops working everywhere else at once.
 */
export default function Password() {
  const router = useRouter();
  const account = useStore((state) => state.account);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const longEnough = next.length >= MIN;
  const same = next.length > 0 && next === again;
  const fresh = next.length > 0 && next !== current;
  const ready = current.length > 0 && longEnough && same && fresh;

  const change = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    const res = await api.changePassword(current, next);
    setBusy(false);
    if (res.ok) {
      successFeedback();
      setDone(true);
      setCurrent(''); setNext(''); setAgain('');
      return;
    }
    setProblem(res.status === 400 || res.status === 401
      ? 'That isn’t your current password.'
      : res.error === 'offline' || res.error === 'timeout'
        ? 'Couldn’t reach Ballast. Check your connection.'
        : 'Couldn’t change it. Try again.');
  };

  if (!account || account.isGuest) {
    return (
      <Screen back={'/settings' as Href} backLabel="Settings">
        <Stack gap={4} className="pt-6">
          <Text variant="title">No password yet</Text>
          <Text variant="body" tone="muted">Keep your account with an email and password first.</Text>
          <Button label="Back to settings" onPress={() => router.replace('/settings' as Href)} />
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen
      back={'/settings' as Href}
      backLabel="Settings"
      footer={done ? (
        <Button label="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings' as Href))} />
      ) : (
        <Button
          label={busy ? 'Changing…' : 'Change password'}
          kind={ready && !busy ? 'primary' : 'secondary'}
          accessibilityState={{ disabled: !ready || busy }}
          onPress={() => void change()}
        />
      )}
    >
      <Stack gap={5} className="pt-2">
        <PageHeader sticker="star" wash={color.decor.lemon} eyebrow={account.email} title="Password" />
        {done ? <Burst show label="Changed" /> : null}

        {done ? (
          <Stack gap={2} className="rounded-xl px-5 py-5" style={{ backgroundColor: color.band.steady.wash }}>
            <Text variant="heading" tone="steady">✓ Password changed</Text>
            <Text variant="callout" tone="muted">Your other devices are signed out. This one stays in.</Text>
          </Stack>
        ) : (
          <Stack gap={4}>
            <Field label="CURRENT PASSWORD" value={current} onChange={setCurrent} show={show} autoComplete="current-password" />
            <Field label="NEW PASSWORD" value={next} onChange={setNext} show={show} autoComplete="new-password" />
            <Field label="NEW PASSWORD, AGAIN" value={again} onChange={setAgain} show={show} autoComplete="new-password" />

            {/* What a new password needs, ticked off as it is typed. */}
            <Stack gap={1}>
              <Rule ok={longEnough} text={`At least ${MIN} characters`} />
              <Rule ok={same} text="Both new ones match" />
              <Rule ok={fresh && next.length > 0} text="Different from the current one" />
            </Stack>

            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: show }}
              onPress={() => { tapFeedback(); setShow(!show); }}
              className="min-h-min justify-center self-start active:opacity-60"
            >
              <Text variant="caption" weight="semibold" className="underline">{show ? 'Hide passwords' : 'Show passwords'}</Text>
            </Pressable>

            {problem ? (
              <View className="rounded-lg bg-heavy-wash px-4 py-3">
                <Text variant="callout" weight="semibold" tone="heavy">{problem}</Text>
              </View>
            ) : null}
            <Text variant="micro" tone="subtle">🔒 Changing it signs you out on your other devices.</Text>
          </Stack>
        )}
      </Stack>
    </Screen>
  );
}

function Field({ label, value, onChange, show, autoComplete }: {
  label: string; value: string; onChange: (text: string) => void; show: boolean; autoComplete: 'current-password' | 'new-password';
}) {
  return (
    <Stack gap={2}>
      <Text variant="micro" tone="subtle">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={autoComplete === 'current-password' ? 'password' : 'newPassword'}
        accessibilityLabel={label.toLowerCase()}
        className="min-h-row rounded-pill border-2 border-line-hairline bg-sunken px-5 py-3 text-body text-ink-default"
        style={inputStyle}
      />
    </Stack>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <Text variant="footnote" tone={ok ? 'steady' : 'subtle'}>{ok ? '✓' : '○'} {text}</Text>
  );
}
