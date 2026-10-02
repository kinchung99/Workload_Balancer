/**
 * A list of people that still works at eighty.
 *
 * A search box on top. Until something is typed: the few you talk to most,
 * then everyone A to Z under their letter. Once something is typed: only the
 * names that match, best first. The same list browses your circle and picks
 * people for a plan, a group or a privacy rule - only what sits on the right of
 * each row changes.
 */
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { Avatar, Stack, Text } from '@/components';
import { color } from '@design/tokens';
import { BAND_WORD, byLetter, isStale, lastSeen, searchPeople } from '@/lib/circle';
import { tapFeedback } from '@/lib/haptics';
import type { CircleMember } from '@/lib/types';

const TONE = { steady: 'steady', busy: 'busy', heavy: 'heavy', recovery: 'recovery' } as const;

/** A search field. Also drawn, inert, as the way into the full list. */
export function SearchBox({
  value, onChange, placeholder = 'Search friends', autoFocus = false,
}: { value: string; onChange: (next: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <View className="min-h-min flex-row items-center gap-2 rounded-pill border-2 border-line-hairline bg-sunken px-4">
      <Text variant="callout">🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.ink.subtle}
        accessibilityLabel={placeholder}
        autoFocus={autoFocus}
        autoCorrect={false}
        className="min-h-min flex-1 py-3 text-body text-ink-default"
        // The pill is the field's outline; the browser's square focus ring is not needed inside it.
        style={Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : undefined}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} className="min-h-min justify-center px-1 active:opacity-60">
          <Text variant="callout" tone="subtle">✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PeopleList({
  people,
  frequent = [],
  selected,
  onToggle,
  onOpen,
  right,
  autoFocus = false,
  placeholder = 'Search friends',
}: {
  /** Everyone who could be listed. You are never in your own list. */
  people: CircleMember[];
  /** The few on top while nothing is typed. */
  frequent?: CircleMember[];
  /** With this, every row is a checkbox. */
  selected?: string[];
  onToggle?: (id: string) => void;
  /** Without `selected`: what a tap on a row does. */
  onOpen?: (person: CircleMember) => void;
  /** Something of your own on the right of a row, such as a switch. */
  right?: (person: CircleMember) => ReactNode;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const found = searchPeople(people, query);
  const letters = byLetter(people);

  const row = (person: CircleMember, prefix: string) => (
    <PersonLine
      key={`${prefix}-${person.id}`}
      person={person}
      selected={selected ? selected.includes(person.id) : undefined}
      onPress={() => {
        tapFeedback();
        if (selected && onToggle) onToggle(person.id);
        else onOpen?.(person);
      }}
      right={right?.(person)}
    />
  );

  return (
    <Stack gap={4}>
      <SearchBox value={query} onChange={setQuery} autoFocus={autoFocus} placeholder={placeholder} />

      {query.trim() ? (
        found.length ? (
          <Group title={`${found.length} found`}>{found.map((person) => row(person, 'found'))}</Group>
        ) : (
          <Text variant="footnote" tone="muted" className="text-center">No one called “{query.trim()}”.</Text>
        )
      ) : (
        <>
          {frequent.length ? <Group title="⭐ Frequent">{frequent.map((person) => row(person, 'frequent'))}</Group> : null}
          {letters.map(({ letter, people: under }) => (
            <Group key={letter} title={letter}>{under.map((person) => row(person, letter))}</Group>
          ))}
        </>
      )}
    </Stack>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text variant="micro" tone="subtle" className="px-1">{title.toUpperCase()}</Text>
      <View className="overflow-hidden rounded-lg border border-line-hairline bg-raised">{children}</View>
    </Stack>
  );
}

/** One person, one line: face, name, a short line, battery - and a tick or a chevron. */
function PersonLine({ person, selected, onPress, right }: {
  person: CircleMember;
  selected?: boolean;
  onPress: () => void;
  right?: ReactNode;
}) {
  const stale = isStale(person);
  const checkbox = selected !== undefined;
  return (
    <Pressable
      accessibilityRole={checkbox ? 'checkbox' : 'button'}
      accessibilityState={checkbox ? { checked: selected } : undefined}
      accessibilityLabel={`${person.name}, ${person.charge ?? 0}%`}
      onPress={onPress}
      className="min-h-row flex-row items-center gap-3 border-b border-line-hairline px-3 py-2 active:opacity-70"
    >
      <Avatar initials={person.initials} band={person.band} stale={stale} size={44} pic={person.pic} mood={person.mood} />
      <Stack gap={1} grow>
        <Text variant="body" weight="semibold" numberOfLines={1}>{person.name}</Text>
        <Text variant="micro" tone={stale ? 'subtle' : TONE[person.band]} numberOfLines={1}>
          {person.status ? `“${person.status}”` : stale ? lastSeen(person) : BAND_WORD[person.band]}
        </Text>
      </Stack>
      <View className="rounded-pill px-2 py-1" style={{ backgroundColor: stale ? color.surface.sunken : color.band[person.band].wash }}>
        <Text variant="micro" weight="bold" tone={stale ? 'subtle' : TONE[person.band]}>{person.charge ?? '–'}%</Text>
      </View>
      {right ?? (checkbox ? (
        <View
          className="items-center justify-center rounded-pill"
          style={{
            width: 26, height: 26,
            backgroundColor: selected ? color.surface.inverse : color.surface.page,
            borderWidth: 2, borderColor: selected ? color.surface.inverse : color.line.strong,
          }}
        >
          {selected ? <Text variant="micro" weight="bold" tone="inverse">✓</Text> : null}
        </View>
      ) : (
        <Text variant="heading" tone="subtle">›</Text>
      ))}
    </Pressable>
  );
}
