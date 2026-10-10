import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
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
import { shownMood } from '@/lib/checkin';
import { FACES, canPickPhoto, pickPhoto } from '@/lib/photo';
import { PersonRow } from '@/features/social/PersonRow';

/** Short enough to read at a glance in a list, which is the only place it appears. */
const STATUS_MAX = 60;

/**
 * Edit profile — the things other people actually see.
 *
 * Every social app has this screen and it is always the same fields: the
 * picture, the name, the line, and the private contact detail. The picture is a
 * photo from your phone, squared and shrunk before it is kept, or one of a row
 * of faces for anyone who would rather not; initials on your ring otherwise.
 *
 * The preview at the top is the point. You are editing how you appear **in your
 * friends' list**, so the screen shows you that row rather than a form and a
 * hope.
 */
export default function Profile() {
  const router = useRouter();
  const { account, setAccount, status, setStatus, pic, setPic: keepPic, moods, vibe, mode } = useStore();
  // Your picture is kept on your account too, so it follows you to every device
  // and your friends see it - not only this phone.
  const setPic = (next: string | null) => {
    keepPic(next);
    if (mode === 'live' && account) void api.updateMe({ pic: next });
  };
  const reading = useReading();
  const band = bandFor(reading.overall);

  const [name, setName] = useState(account?.name ?? '');
  const [initials, setInitials] = useState(account?.initials ?? '');
  const [line, setLine] = useState(status ?? '');
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  // Known only in the browser, so decided after the first paint - the page the
  // server rendered and the one the browser takes over then match.
  const [canUpload, setCanUpload] = useState(false);
  useEffect(() => setCanUpload(canPickPhoto), []);

  // What the circle will show. Typed initials win; otherwise they follow the name.
  const shown = (initials.trim() || (name.trim() ? initialsFrom(name) : 'Y')).slice(0, 2).toUpperCase();

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
        <Card tone={band} gap={3}>
          <Text variant="micro" tone="subtle">WHAT YOUR FRIENDS SEE</Text>
          <PersonRow
            name={name.trim() || 'You'}
            initials={shown}
            band={band}
            charge={reading.charge}
            pic={pic}
            mood={shownMood(vibe, moods)}
            status={line.trim() || null}
            line="just now"
            active
          />
        </Card>

        {/* Your picture: a photo, a face, or your initials. */}
        <Card gap={4}>
          <Stack direction="row" align="center" justify="between">
            <Text variant="micro" tone="subtle">PICTURE</Text>
            {pic ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Remove picture" onPress={() => { tapFeedback(); setPic(null); }} className="min-h-min justify-center active:opacity-60">
                <Text variant="caption" weight="semibold" className="underline">Remove</Text>
              </Pressable>
            ) : null}
          </Stack>
          {canUpload ? (
            <Button
              label="📷 Upload a photo"
              kind="secondary"
              onPress={async () => {
                const photo = await pickPhoto();
                if (photo) { setPic(photo); successFeedback(); }
              }}
            />
          ) : null}
          <Stack direction="row" gap={2} wrap>
            {FACES.map((face) => (
              <Pressable
                key={face}
                accessibilityRole="radio"
                accessibilityState={{ selected: pic === face }}
                accessibilityLabel={`Picture ${face}`}
                onPress={() => { tapFeedback(); setPic(face); }}
                className="items-center justify-center rounded-pill active:opacity-60"
                style={{
                  width: 46, height: 46,
                  backgroundColor: pic === face ? color.decor.lemon : color.surface.sunken,
                  borderWidth: pic === face ? 2 : 0, borderColor: color.ink.default,
                }}
              >
                <Text variant="heading">{face}</Text>
              </Pressable>
            ))}
          </Stack>
        </Card>

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
              placeholder={name.trim() ? initialsFrom(name) : 'Y'}
              placeholderTextColor={color.ink.subtle}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={2}
              accessibilityLabel="Initials"
              className="min-h-row rounded-md border-2 border-line-hairline bg-decor-cream px-4 py-3 text-body text-ink-default"
            />
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
          <Text variant="micro" tone="muted">🔒 Only for opening WhatsApp. Never shared.</Text>
        </Card>

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
