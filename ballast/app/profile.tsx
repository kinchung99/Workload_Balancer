import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Avatar, Button, Card, Chip, PageHeader, Screen, Stack, Text,
} from '@/components';
import { color } from '@design/tokens';
import { SCREEN } from '@design/screens';
import { bandFor } from '@/lib/load';
import { initialsFrom } from '@shared/initials';
import { api } from '@/lib/api';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useStore } from '@/state/store';
import { useReading } from '@/state/selectors';

/** Short enough to read at a glance in a list, which is the only place it appears. */
const STATUS_MAX = 60;

/**
 * Edit profile — the four things other people actually see.
 *
 * Every social app has this screen and it is always the same four fields: the
 * picture, the name, the line, and the private contact detail. Ours swaps the
 * picture for initials on a coloured ring, because a photo is a whole upload
 * pipeline and a storage bill for something a circle of four already recognises.
 *
 * The preview at the top is the point. You are editing how you appear **in your
 * friends' list**, so the screen shows you that row rather than a form and a
 * hope.
 */
export default function Profile() {
  const router = useRouter();
  const { account, setAccount, status, setStatus } = useStore();
  const reading = useReading();
  const band = bandFor(reading.overall);

  const [name, setName] = useState(account?.name ?? '');
  const [initials, setInitials] = useState(account?.initials ?? '');
  const [line, setLine] = useState(status ?? '');
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // What the circle will show. Typed initials win; otherwise they follow the name.
  const shown = (initials.trim() || initialsFrom(name || 'You')).slice(0, 2).toUpperCase();

  const save = async () => {
    setBusy(true);
    setStatus(line);

    // Signed out, this is still worth doing: the status shows on your own
    // profile either way, and the name is what the seeded demo calls you.
    if (account) {
      const res = await api.updateMe({
        name: name.trim() || account.name,
        initials: shown,
        phone: phone.trim() || null,
      });
      if (res.ok) {
        const me = await api.me();
        if (me.ok) setAccount(me.data);
      }
    }
    setBusy(false);
    setSaved(true);
    successFeedback();
  };

  return (
    <Screen
      back="/you"
      backLabel="You"
      footer={
        <Button
          label={busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
          kind={saved ? 'secondary' : 'primary'}
          onPress={() => { if (!busy) void save(); }}
        />
      }
    >
      <Stack gap={5} className="pt-2">
        <PageHeader {...SCREEN.you} eyebrow="Edit profile" title="How you appear" />

        {/* The live preview: this is your row in somebody else's circle. */}
        <Stack gap={3}>
          <Text variant="micro" tone="subtle">WHAT YOUR FRIENDS SEE</Text>
          <Card tone={band} gap={4}>
            <Stack direction="row" gap={4} align="center">
              <Avatar initials={shown} band={band} size={56} />
              <Stack gap={1} grow>
                <Stack direction="row" gap={3} align="center">
                  <Text variant="body" weight="semibold">{name.trim() || 'Your name'}</Text>
                  <Text variant="body" weight="semibold">{reading.charge}%</Text>
                </Stack>
                <Text variant="micro" tone="subtle">just now</Text>
                {line.trim() ? <Text variant="micro" tone="muted">“{line.trim()}”</Text> : null}
              </Stack>
            </Stack>
          </Card>
        </Stack>

        <Card gap={5}>
          <Field label="NAME" value={name} onChange={(v) => { setName(v); setSaved(false); }} placeholder="Amira Hassan" autoComplete="name" />

          <Stack gap={2}>
            <Stack direction="row" justify="between" align="center">
              <Text variant="micro" tone="subtle">INITIALS</Text>
              <Text variant="micro" tone="subtle">{shown}</Text>
            </Stack>
            <TextInput
              value={initials}
              onChangeText={(v) => { setInitials(v.slice(0, 2)); setSaved(false); }}
              placeholder={initialsFrom(name || 'You')}
              placeholderTextColor={color.ink.subtle}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={2}
              accessibilityLabel="Initials"
              className="min-h-row rounded-md border-2 border-line-hairline bg-decor-cream px-4 py-3 text-body text-ink-default"
            />
            <Text variant="micro" tone="subtle">Leave it blank to follow your name.</Text>
          </Stack>

          <Stack gap={2}>
            <Stack direction="row" justify="between" align="center">
              <Text variant="micro" tone="subtle">STATUS</Text>
              <Text variant="micro" tone={line.length > STATUS_MAX - 10 ? 'busy' : 'subtle'}>
                {line.length}/{STATUS_MAX}
              </Text>
            </Stack>
            <TextInput
              value={line}
              onChangeText={(v) => { setLine(v.slice(0, STATUS_MAX)); setSaved(false); }}
              placeholder="Two labs and a shift"
              placeholderTextColor={color.ink.subtle}
              maxLength={STATUS_MAX}
              accessibilityLabel="Status"
              className="min-h-row rounded-md border-2 border-line-hairline bg-decor-cream px-4 py-3 text-body text-ink-default"
            />
            {/* Suggestions, because a blank box is the reason status lines stay blank. */}
            <Stack direction="row" gap={2} wrap>
              {['Deadline week', 'Finally handed it in', 'Free most of this week', 'Running on fumes'].map((suggestion) => (
                <Chip
                  key={suggestion}
                  label={suggestion}
                  tone={line === suggestion ? 'selected' : 'plain'}
                  onPress={() => { tapFeedback(); setLine(suggestion); setSaved(false); }}
                />
              ))}
            </Stack>
          </Stack>
        </Card>

        <Card gap={4}>
          <Field
            label="PHONE (OPTIONAL)"
            value={phone}
            onChange={(v) => { setPhone(v); setSaved(false); }}
            placeholder="60123456789"
            keyboardType="phone-pad"
          />
          {/*
            The one place a phone number needs explaining, said where it is typed
            rather than in a policy nobody opens.
          */}
          <Text variant="micro" tone="muted">
            Only used to open WhatsApp from this phone. Never shared with anyone, never uploaded to find you.
          </Text>
        </Card>

        {!account ? (
          <Card tone="sunken" gap={2}>
            <Text variant="footnote" weight="semibold">You are not signed in.</Text>
            <Text variant="micro" tone="muted">
              Your status saves on this device. Sign in for it to reach your circle.
            </Text>
          </Card>
        ) : null}

        <View className="h-2" />
      </Stack>
    </Screen>
  );
}

function Field({
  label, value, onChange, placeholder, autoComplete, keyboardType,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  autoComplete?: 'name';
  keyboardType?: 'phone-pad';
}) {
  return (
    <Stack gap={2}>
      <Text variant="micro" tone="subtle">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.ink.subtle}
        autoCorrect={false}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        accessibilityLabel={label}
        className="min-h-row rounded-md border-2 border-line-hairline bg-decor-cream px-4 py-3 text-body text-ink-default"
      />
    </Stack>
  );
}
