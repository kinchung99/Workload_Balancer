/**
 * App state. Zustand, because the whole model is small, local and synchronous.
 *
 * Frontend study: state lives in memory and starts from the seeded semester on
 * every launch. The place a real build would swap in SQLite is `seedItems` and
 * nowhere else - every screen already reads through the selectors below.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SCHEMA_VERSION, STORAGE_KEY, migrateSaved, storage } from './storage';
import type {
  BucketKey, CircleMember, Contact, ContributionTag, DayReport, Dread, Errand, Item, Meal, MealStatus, MoodCheckIn,
  MoodQuadrant, Dread as DreadLevel, ErrandCategory, Invite, Module, Moment, Prescription,
  RecoveryEntry, SimAction, Trade, Mix, CustomFlag, FlagId, Group, PlanActivity, ShareRules, ShareWindow, Outcome,
  GroupInvite, Notice, ReceivedInvite,
  CalDecision, CalendarEvent, CalendarLink, CalTemplate,
} from '@/lib/types';
import { DEFAULT_SHARE_RULES, type PhoneContact, type ShareMode } from '@/lib/sharing';
import type { Collection, GroupDTO, InviteDTO, MeDTO, PendingRequestDTO } from '@shared/contract';
import { DEMO_ANSWER_MS, firstName, initialsOf, nameFromEmail } from '@/lib/people';
import { DEFAULT_CEILINGS, DEFAULT_OVERALL_CEILING } from '@/lib/load';
import { mergeInto } from './snapshot';
import { REST_LOAD_PER_HOUR, loadOf, percentByBucket, overallOf, isMovable, recalibrate } from '@/lib/load';
import { applySelection } from '@/lib/rebalance';
import { completionCredit } from '@/lib/errands';
import { classItems, customFlagId, type ClassSlot } from '@/lib/timetable';
import { applyMark, applyRegister, autoMark, clockHour } from '@/lib/marking';
import { followCalendar, itemFrom } from '@/lib/gcal';
import { sampleCalendar, sampleLink } from '@/data/sampleCalendar';
import { countedOnce } from '@/lib/prep';
import { upsertMeal } from '@/lib/checkin';
import { SLEEP_TARGET } from '@/lib/logs';
import { isSameWeek, addDays, formatShort } from '@/lib/dates';
import { formatHour } from '@/lib/schedule';
import { planItem } from '@/lib/simulate';
import {
  CEILINGS, OVERALL_CEILING, TODAY, circle as seedCircle, contacts as seedContacts,
  customActions as seedCustomActions, errands as seedErrands, meals as seedMeals, modules as seedModules,
  moodHistory, phoneContacts as seedPhoneContacts, recoveryLedger, seedItems, groups as seedGroups,
  friendRequests as seedRequests, groupInvites as seedGroupInvites, receivedInvites as seedReceived, sentInvites as seedSent,
} from '@/data/seed';

/**
 * The seeded semester, the morning after Sunday: whatever nobody marked
 * yesterday is already marked done, and waiting on Home to be reviewed.
 */
const SEEDED = autoMark(seedItems, seedModules, TODAY);

interface State {
  today: string;
  /** False until the intro has been through once. Drives the first-run route. */
  onboarded: boolean;
  items: Item[];
  ceilings: Record<BucketKey, number>;
  overallCeiling: number;
  /** Past the calm-mode line the interface collapses. Overridable, per session. */
  showEverythingAnyway: boolean;
  /** One switch for the worst weeks. Nothing is deleted, it is out of sight. */
  minimumViableWeek: boolean;
  /** The one daily tap. Feeds ceiling calibration. */
  dayReports: DayReport[];

  // Per-area logs. Each area records the thing it is actually made of.
  moods: MoodCheckIn[];
  meals: Meal[];
  errands: Errand[];
  contacts: Contact[];
  /** The ledger, mutable: booking recovery writes a credit into it. */
  recovery: RecoveryEntry[];
  /** Prescription ids already in the calendar, so they stop being suggested. */
  booked: string[];
  /** Hours slept last night. Null until logged; nothing is assumed. */
  sleepHours: number | null;
  /** Gatherings you proposed. Local until someone accepts - the honest state. */
  invites: Invite[];
  /** One-tap records of things that went well. The only input that adds charge. */
  moments: Moment[];
  /**
   * When your day is your own.
   *
   * Booking a run at 11am is not a plan for someone with a 5pm finish, so nothing
   * on the Tonight screen is placed before this hour.
   */
  offHour: number;
  /** Activities the student added themselves - badminton, a night run. */
  customActions: SimAction[];
  /** The courses behind the timetable. Dread lives here, not on each class. */
  modules: Module[];
  /**
   * Your circle. State rather than a constant, because you can add to it.
   *
   * It was a seeded module export while nothing could change it, and a "find
   * friends" screen whose Add button did nothing would be worse than no screen.
   */
  circle: CircleMember[];
  /** The address book, as the app would see it. See `phoneContacts` in the seed. */
  phoneContacts: PhoneContact[];
  /** How much of your week your circle can see. Yours, changeable, off included. */
  sharing: ShareMode;
  /** Custom sharing: which hours of which days, and who sees nothing at all. */
  shareRules: ShareRules;
  /** Reasons of the student's own for a class to matter more than its hours. */
  customFlags: CustomFlag[];
  /** Friends you plan with often. */
  groups: Group[];
  /** Your own usual activities, for plans made outside a group. */
  planActivities: PlanActivity[];
  /**
   * The signed-in account, or null.
   *
   * Null is a first-class state, not an error: everything in this app works
   * without one. Signing in adds sync and the circle; it is never a gate in
   * front of the week.
   */
  account: MeDTO | null;
  /**
   * Whose week this is.
   *
   * `demo` is the seeded semester — the interface study, the thing the public
   * link has always shown, and what every check in `npm run preflight` asserts.
   * `live` is a real person's own data, which starts empty and fills as they use
   * it. Signing in switches modes; signing out switches back.
   *
   * Keeping both is what lets the demo survive the product being real.
   */
  mode: 'demo' | 'live';
  /**
   * One line you wrote about how you are.
   *
   * The only free text anybody else ever sees. Never generated, never inferred
   * from your week - the app has a battery for that, and a sentence a person
   * chose says something a number cannot.
   */
  status: string | null;
  /** The emoji you picked for your note, on the corner of your picture. */
  vibe: string | null;
  /**
   * Friend requests waiting on an answer, in live mode.
   *
   * Held in the store rather than fetched per screen so the count can sit on a
   * door without every screen that shows it making its own request.
   */
  requests: PendingRequestDTO[];
  /** Groups somebody asked you into, waiting on your answer. */
  groupInvites: GroupInvite[];
  /** Plans other people made and asked you to. */
  received: ReceivedInvite[];
  /** Things that happened, newest first. */
  notices: Notice[];
  /** Notification ids already seen, so the bell counts only what is new. */
  seenNotices: string[];
  /** Google Calendar, once connected. Null until then. */
  calendar: CalendarLink | null;
  /** The server has Google keys (live) - without them there is nothing to connect. */
  calendarAvailable: boolean;
  /** What is coming up on it, in the phone's own time. */
  calendarEvents: CalendarEvent[];
  /** Your answer per event, or per repeating series: set up how, or skipped. */
  calendarHandled: Record<string, CalDecision>;
  /** "Later" on Home's calendar card: the day it was put off. */
  calendarLater: string | null;
  /**
   * Your picture: a photo (an image URI) or an emoji you chose instead.
   * Null shows your initials on your ring. A fact about you, so it survives a reload.
   */
  pic: string | null;
  /** "Later" on the marking notification: quiet until the app is opened again. */
  marksSnoozed: boolean;
  /**
   * Looking around with the sample week and no account. Only offered by
   * preview builds - a real build signs everyone in (see `lib/access`).
   */
  guest: boolean;
  /** The saved session has been asked about. Until then nobody is sent to sign in. */
  sessionChecked: boolean;
  /**
   * Who was signed in on this device last time, kept across reloads. Only a
   * hint: it is why a reload waits for the server instead of flashing the
   * sign-in screen, and the server's answer is what counts.
   */
  lastAccountId: string | null;

  addItem: (item: Omit<Item, 'id'>) => void;
  setDread: (id: string, dread: Dread) => void;
  applyTrades: (trades: Trade[]) => void;
  dropSwap: (id: string) => void;
  addFriend: (contactId: string) => void;
  setSharing: (visibility: ShareMode) => void;
  setShareRules: (patch: Partial<ShareRules>) => void;
  setShareDay: (day: number, window: ShareWindow) => void;
  toggleHiddenFrom: (friendId: string) => void;
  addCustomFlag: (flag: Omit<CustomFlag, 'id'>) => string;
  removeCustomFlag: (id: string) => void;
  createGroup: (group: Omit<Group, 'id'>) => string;
  updateGroup: (id: string, patch: Partial<Omit<Group, 'id'>>) => void;
  toggleGroupMember: (groupId: string, friendId: string) => void;
  deleteGroup: (id: string) => void;
  /** A usual activity, saved to a group or - with no group - to your own list. Returns its id. */
  addActivity: (activity: Omit<PlanActivity, 'id'>, groupId?: string) => string;
  removeActivity: (id: string, groupId?: string) => void;
  setAccount: (account: MeDTO | null) => void;
  setStatus: (status: string | null) => void;
  setVibe: (vibe: string | null) => void;
  goLive: (account: MeDTO, today: string) => void;
  /** The circle as the server last reported it. Seeded in demo, fetched in live. */
  setCircle: (circle: CircleMember[]) => void;
  setRequests: (requests: PendingRequestDTO[]) => void;
  /** Ask someone to be friends. They are not in your circle until they say yes. */
  sendFriendRequest: (email: string, name?: string, id?: string) => void;
  /** Your answer to someone who asked - or taking back your own request. */
  answerFriendRequest: (userId: string, accept: boolean) => void;
  /** Ask friends into a group. They join only when they say yes. */
  inviteToGroup: (groupId: string, friendIds: string[]) => void;
  cancelGroupInvite: (groupId: string, friendId: string) => void;
  removeGroupMember: (groupId: string, friendId: string) => void;
  /** Your answer to a group somebody asked you into. */
  answerGroupInvite: (id: string, accept: boolean) => void;
  addNotice: (notice: Omit<Notice, 'id' | 'at'>) => void;
  seeNotices: (ids: string[]) => void;
  /** The sample week's friends answering, a few seconds after being asked. */
  demoTick: (now: number) => void;
  /** Groups as the server holds them, in a signed-in week. */
  setGroupsFromServer: (groups: GroupDTO[], me: string) => void;
  /** A plan you sent, into your own week - once enough people said yes. */
  scheduleInvite: (id: string) => void;
  /** Call a plan off: gone for everyone, and out of your week. */
  cancelInvite: (id: string) => void;
  /** Yes or no to a plan you were asked to. Yes puts it in your week. */
  answerReceived: (id: string, yes: boolean) => void;
  /** Plans as the server holds them, sent and received, in a signed-in week. */
  setInvitesFromServer: (invites: InviteDTO[], me: string) => void;
  setCalendarLink: (link: CalendarLink | null, available?: boolean) => void;
  /** What Google has coming up. Also adds the next weeks of set-up series and follows moved times. */
  setCalendarEvents: (events: CalendarEvent[]) => void;
  /** Set up an event - or every week of a repeating one - the way the student said. */
  setUpCalendar: (key: string, template: CalTemplate, events: CalendarEvent[]) => void;
  skipCalendar: (keys: string[]) => void;
  unskipCalendar: (key: string) => void;
  calendarLaterToday: () => void;
  /** Demo only: a sample Google Calendar, so the whole flow can be tried. */
  connectSampleCalendar: () => void;
  setSampleCalendarsOn: (ids: string[]) => void;
  forgetCalendar: () => void;
  goDemo: () => void;
  hydrate: (upserts: Map<Collection, Array<{ id: string; data: unknown }>>, deletes: Map<Collection, string[]>) => void;
  setShowEverything: (value: boolean) => void;
  setMinimumViableWeek: (value: boolean) => void;
  finishOnboarding: () => void;
  bookRecovery: (prescription: Prescription, startHour: number, hours: number, date?: string) => void;
  markContacted: (id: string) => void;
  logSleep: (hours: number) => void;
  sendInvite: (invite: Omit<Invite, 'id'> & { id?: string }) => void;
  logMoment: (kind: string, bucket: BucketKey, credit: number, note?: string) => void;
  logProgress: (id: string, hours: number) => void;
  moveItem: (id: string, date: string) => void;
  scheduleSessions: (
    parentId: string,
    sessions: Array<{ date: string; startHour: number; hours: number; note?: string }>,
    options?: { replace?: boolean },
  ) => void;
  unscheduleSession: (sessionId: string) => void;
  /** Move or resize one booked sitting. The day, the time and the length are each optional. */
  updateSession: (sessionId: string, patch: { date?: string; startHour?: number; hours?: number }) => void;
  setSessionNote: (sessionId: string, note: string) => void;
  completeSitting: (sessionId: string) => void;
  logUnbookedHours: (id: string, hours: number) => void;
  keepItem: (id: string, pushId: string) => void;
  applyPlan: (
    blocks: Array<{ id: string; label: string; bucket: BucketKey; hours: number; credit: number; startHour?: number }>,
    sleepHours?: number,
    date?: string,
  ) => void;
  clearPlan: (date: string) => void;
  setOffHour: (hour: number) => void;
  addCustomAction: (action: SimAction) => void;
  removeCustomAction: (id: string) => void;
  pushSittings: (parentId: string, from: string, to: string) => void;
  setModuleDread: (moduleId: string, dread: DreadLevel) => void;
  setModuleImportance: (moduleId: string, importance: 1 | 2 | 3) => void;
  toggleClassFlag: (itemId: string, flag: FlagId) => void;
  /**
   * Say what happened: done, partly done (with how much) or missed - or, with
   * no outcome, take the answer back.
   */
  markItem: (id: string, outcome: Outcome | undefined, fraction?: number) => void;
  setModuleWeeks: (moduleId: string, weeks: number) => void;
  setModuleRequired: (moduleId: string, required: number | null) => void;
  /** The rarely-changed details set at import: its picture, and which week it started. */
  updateModule: (moduleId: string, patch: Partial<Pick<Module, 'emoji' | 'startDate'>>) => void;
  setPic: (pic: string | null) => void;
  snoozeMarks: () => void;
  /** The sample week, as a guest. */
  startGuest: () => void;
  /** Signed out, or a guest leaving: back to the sign-in screen. */
  endSession: () => void;
  setSessionChecked: () => void;
  importTimetable: (items: Item[], modules: Module[]) => void;
  /** A module made by hand, ready for its classes. Returns its id. */
  addModule: (module: Pick<Module, 'name' | 'code' | 'emoji' | 'weeks' | 'startDate' | 'requiredAttendance'> & { dread?: Dread }) => string;
  removeModule: (moduleId: string) => void;
  /** A weekly class, into this week and the next. Adding the same one twice does nothing. */
  addClass: (moduleId: string, slot: ClassSlot) => void;
  removeClass: (moduleId: string, day: number, startHour: number) => void;
  reportDay: (felt: 'fine' | 'meh' | 'hard', percent: number, verdict?: DayReport['verdict']) => void;
  logMood: (quadrant: MoodQuadrant, tags: ContributionTag[]) => void;
  setMealStatus: (id: string, status: MealStatus) => void;
  toggleErrand: (id: string) => void;
  addErrand: (
    title: string,
    category: ErrandCategory,
    hours: number,
    effort: 1 | 2 | 3,
    when: { date: string; startHour?: number },
    bucket?: BucketKey,
    mix?: Mix,
    want?: Item['want'],
  ) => void;
  scheduleItem: (id: string, startHour: number | undefined) => void;
  cycleContact: (id: string) => void;
  reset: () => void;
}

/** Someone who said yes, as a circle member, before their first reading arrives. */
const newFriend = (request: PendingRequestDTO): CircleMember => ({
  id: request.userId, name: request.name, initials: request.initials, band: 'steady', charge: 72, updatedMinsAgo: 1, frequency: 0,
});

/** A plan as the block it becomes in your week. */
const planAsItem = (plan: { id: string; title: string; date: string; startHour: number; hours: number }): Item => ({
  id: plan.id, title: plan.title, bucket: 'social', hours: plan.hours, dread: 1, commitment: 'soft', date: plan.date, startHour: plan.startHour,
});

/** "Dinner with Amin and Ravi" → "Dinner", for a line that has to stay short. */
const shortTitle = (title: string): string => title.split(/ with | · /)[0] ?? title;

let noticeCount = 0;
/** One thing that happened, stamped now. */
const notice = (emoji: string, title: string, to?: string, body?: string): Notice => ({
  id: `n-${Date.now().toString(36)}-${(noticeCount += 1)}`, at: new Date().toISOString(), emoji, title, ...(to ? { to } : {}), ...(body ? { body } : {}),
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
  today: TODAY,
  onboarded: false,
  items: SEEDED.items,
  ceilings: CEILINGS,
  overallCeiling: OVERALL_CEILING,
  showEverythingAnyway: false,
  minimumViableWeek: false,
  dayReports: [],
  moods: moodHistory,
  meals: seedMeals,
  errands: seedErrands,
  contacts: seedContacts,
  recovery: recoveryLedger,
  booked: [],
  sleepHours: null,
  invites: seedSent,
  moments: [],
  offHour: 17,
  customActions: seedCustomActions,
  modules: SEEDED.modules,
  circle: seedCircle,
  phoneContacts: seedPhoneContacts,
  // Free evenings by default, which is what makes the planning side work at all.
  // Off is one tap away and is genuinely off, not "off but still discoverable".
  sharing: 'evenings',
  shareRules: DEFAULT_SHARE_RULES,
  customFlags: [],
  groups: seedGroups,
  planActivities: [],
  account: null,
  mode: 'demo',
  requests: seedRequests,
  groupInvites: seedGroupInvites,
  received: seedReceived,
  notices: [],
  seenNotices: [],
  calendar: null,
  calendarAvailable: true,
  calendarEvents: [],
  calendarHandled: {},
  calendarLater: null,
  status: null,
  vibe: null,
  pic: null,
  marksSnoozed: false,
  guest: false,
  sessionChecked: false,
  lastAccountId: null,

  addItem: (item) =>
    set((state) => {
      // The same title, same day, same hour is one thing, however many times the
      // button was pressed.
      const duplicate = state.items.some(
        (existing) =>
          existing.title === item.title &&
          existing.date === item.date &&
          existing.startHour === item.startHour,
      );
      if (duplicate) return {};
      return { items: [...state.items, { ...item, id: `user-${Date.now()}` }] };
    }),

  /**
   * How much you mind it, and so what it costs.
   *
   * Sittings copy their parent's dread when booked, so changing it here used to
   * re-price the assignment and leave its booked hours at the old price. The
   * ones still ahead follow it now; a sitting already done keeps what it cost.
   */
  setDread: (id, dread) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id || (i.parentId === id && !i.sessionDone) ? { ...i, dread } : i,
      ),
    })),

  /**
   * What "apply" actually does: moves the calendar blocks and batches the
   * errand trip. It does not send anything without you reading it first, so the
   * two messages that need sending are drafted, not sent.
   */
  /**
   * What "apply" actually does: drops what you chose to put down and adds the
   * batched errand trip back, because batching is a re-plan rather than a
   * deletion.
   *
   * This read its selection from a store field the screen never wrote to, so the
   * set of taken trades was always empty and the button changed nothing at all.
   * The selection now travels on the trades themselves.
   */
  applyTrades: (trades) =>
    set((state) => ({
      items: applySelection(
        state.items,
        trades,
        Object.fromEntries(trades.map((trade) => [trade.id, !!trade.selected])),
      ),
    })),

  /**
   * Take one thing off, because you chose the other one.
   *
   * Separate from `applyTrades` because a swap is one decision about two named
   * things rather than a basket of toggles, and because a task you only have to
   * turn up to lives in the errands list and arrives at the swap model as its
   * row - so the id has to be unwrapped before it can be found.
   */
  dropSwap: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      errands: state.errands.filter((errand) => `log-errand-${errand.id}` !== id),
    })),

  /**
   * Someone from your phone becomes someone in your circle.
   *
   * They arrive with no reading and no published evenings, which is the honest
   * state: you have added them, they have not checked in since, and the circle
   * screen says "never checked in" rather than inventing a battery for them.
   */
  addFriend: (contactId) =>
    set((state) => {
      const contact = state.phoneContacts.find((c) => c.id === contactId);
      /*
       * Someone who is not on Ballast cannot be added, only invited.
       *
       * The screen only offers Invite for them, but allowing it here would put a
       * person in your circle who can never have a reading or a free evening -
       * a permanently blank row, and the one kind of dishonesty this feature
       * cannot afford.
       */
      if (!contact || contact.added || !contact.onBallast) return {};
      return {
        phoneContacts: state.phoneContacts.map((c) => (c.id === contactId ? { ...c, added: true } : c)),
        circle: [
          ...state.circle,
          { id: contact.id, name: contact.name, initials: contact.initials, band: 'steady' as const },
        ],
      };
    }),

  setSharing: (visibility) => set({ sharing: visibility }),

  /** Signing in or out. Deliberately not cleared by `reset`, which is about the week. */
  setAccount: (account) => set({ account }),

  /**
   * Become a real account.
   *
   * Everything seeded goes. A new student opening this should see their own
   * empty week and today's real date — not Amira's Monday in week ten, however
   * good a demo it is. The ceilings start at the generic defaults and move as
   * they report hard days, which is the same calibration the seeded week had
   * already been through.
   */
  goLive: (account, today) =>
    set((state) => ({
      mode: 'live', account, today, guest: false, lastAccountId: account.id,
      // Your note is yours: coming back to the same account keeps it.
      status: state.lastAccountId === account.id ? state.status : null,
      vibe: state.lastAccountId === account.id ? state.vibe : null,
      items: [], errands: [], modules: [], moods: [], meals: [], moments: [],
      recovery: [], contacts: [], dayReports: [], booked: [], invites: [],
      circle: [], phoneContacts: [], customActions: [], requests: [], groupInvites: [], received: [], notices: [],
      // A calendar belongs to an account: the same one comes back as it was.
      ...(state.lastAccountId === account.id ? {} : { calendar: null, calendarEvents: [], calendarHandled: {}, calendarLater: null }),
      sleepHours: null, showEverythingAnyway: false, minimumViableWeek: false,
      ceilings: DEFAULT_CEILINGS, overallCeiling: DEFAULT_OVERALL_CEILING,
      sharing: 'evenings', offHour: 17,
      shareRules: DEFAULT_SHARE_RULES, customFlags: [], groups: [], planActivities: [],
    })),

  /** Back to the interface study. What the public link shows, and what the checks assert. */
  setStatus: (status) => set({ status: status && status.trim() ? status.trim() : null }),
  setVibe: (vibe) => set({ vibe }),
  setCircle: (circle) => set({ circle }),
  setRequests: (requests) => set({ requests }),

  sendFriendRequest: (email, name, id) =>
    set((state) => {
      const key = id ?? `email-${email.trim().toLowerCase()}`;
      if (state.requests.some((r) => r.userId === key) || state.circle.some((p) => p.id === key)) return {};
      const shown = name ?? nameFromEmail(email.trim());
      return {
        requests: [...state.requests, { userId: key, name: shown, initials: initialsOf(shown), direction: 'outgoing' as const, at: new Date().toISOString() }],
      };
    }),

  answerFriendRequest: (userId, accept) =>
    set((state) => {
      const request = state.requests.find((r) => r.userId === userId);
      if (!request) return {};
      const requests = state.requests.filter((r) => r.userId !== userId);
      if (!accept || request.direction === 'outgoing') return { requests };
      return {
        requests,
        circle: [...state.circle, newFriend(request)],
        phoneContacts: state.phoneContacts.map((c) => (c.id === userId ? { ...c, added: true } : c)),
        notices: [notice('🤝', `You and ${firstName(request.name)} are friends`, '/friends'), ...state.notices].slice(0, 40),
      };
    }),

  inviteToGroup: (groupId, friendIds) =>
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        const asked = new Set([...g.members, ...(g.invited ?? []).map((i) => i.id)]);
        const at = new Date().toISOString();
        const fresh = [...new Set(friendIds)].filter((id) => !asked.has(id)).map((id) => ({ id, at }));
        return { ...g, invited: [...(g.invited ?? []), ...fresh] };
      }),
    })),

  cancelGroupInvite: (groupId, friendId) =>
    set((state) => ({
      groups: state.groups.map((g) => (g.id !== groupId ? g : { ...g, invited: (g.invited ?? []).filter((i) => i.id !== friendId) })),
    })),

  removeGroupMember: (groupId, friendId) =>
    set((state) => ({
      groups: state.groups.map((g) => (g.id !== groupId ? g : { ...g, members: g.members.filter((m) => m !== friendId) })),
    })),

  answerGroupInvite: (id, accept) =>
    set((state) => {
      const invite = state.groupInvites.find((i) => i.id === id);
      if (!invite) return {};
      const groupInvites = state.groupInvites.filter((i) => i.id !== id);
      if (!accept) return { groupInvites };
      const known = new Set(state.circle.map((p) => p.id));
      return {
        groupInvites,
        groups: [...state.groups, { id: invite.id, name: invite.name, emoji: invite.emoji, members: (invite.members ?? []).filter((m) => known.has(m)), owner: false }],
        notices: [notice(invite.emoji, `You joined ${invite.name}`, `/group/${invite.id}`), ...state.notices].slice(0, 40),
      };
    }),

  addNotice: (made) => set((state) => ({ notices: [notice(made.emoji, made.title, made.to, made.body), ...state.notices].slice(0, 40) })),

  seeNotices: (ids) =>
    set((state) => {
      const fresh = ids.filter((id) => !state.seenNotices.includes(id));
      return fresh.length ? { seenNotices: [...state.seenNotices, ...fresh].slice(-300) } : {};
    }),

  /*
   * Nobody in the sample week is real, so nobody can say yes. They answer by
   * themselves a few seconds after being asked, which is what lets the whole
   * ask-then-wait-then-join loop be tried out.
   */
  demoTick: (now) =>
    set((state) => {
      if (state.mode !== 'demo') return {};
      const ready = (at: string) => now - Date.parse(at) >= DEMO_ANSWER_MS;
      const answered = state.requests.filter((r) => r.direction === 'outgoing' && ready(r.at));
      const joined = state.groups.flatMap((g) => (g.invited ?? []).filter((i) => ready(i.at)).map((i) => ({ group: g, id: i.id })));
      // Guests of a plan you sent answer too: yes, unless they are running on empty.
      const replies = state.invites.flatMap((invite) => (invite.sentAt && ready(invite.sentAt)
        ? invite.people.filter((id) => !invite.answers?.[id]).map((id) => ({
          invite, id, yes: (state.circle.find((p) => p.id === id)?.charge ?? 60) >= 30,
        }))
        : []));
      if (!answered.length && !joined.length && !replies.length) return {};
      const names = Object.fromEntries(state.circle.map((p) => [p.id, p.name]));
      const fresh: Notice[] = [
        ...answered.map((r) => notice('🎉', `${firstName(r.name)} accepted your request`, '/friends', 'Now in your circle')),
        ...joined.map(({ group, id }) => notice(group.emoji, `${firstName(names[id] ?? 'A friend')} joined ${group.name}`, `/group/${group.id}`)),
        ...replies.map(({ invite, id, yes }) => notice(yes ? '✅' : '❌', `${firstName(names[id] ?? 'A friend')} ${yes ? 'is in for' : "can't make"} ${shortTitle(invite.title)}`, '/plans')),
      ];
      return {
        requests: state.requests.filter((r) => !answered.includes(r)),
        circle: [...state.circle, ...answered.map(newFriend)],
        groups: state.groups.map((g) => {
          const mine = joined.filter((j) => j.group.id === g.id).map((j) => j.id);
          return mine.length
            ? { ...g, members: [...g.members, ...mine], invited: (g.invited ?? []).filter((i) => !mine.includes(i.id)) }
            : g;
        }),
        invites: state.invites.map((invite) => {
          const mine = replies.filter((r) => r.invite.id === invite.id);
          return mine.length
            ? { ...invite, answers: { ...invite.answers, ...Object.fromEntries(mine.map((r) => [r.id, r.yes ? 'yes' as const : 'no' as const])) } }
            : invite;
        }),
        notices: [...fresh, ...state.notices].slice(0, 40),
      };
    }),

  setCalendarLink: (link, available) =>
    set((state) => ({ calendar: link, calendarAvailable: available ?? state.calendarAvailable })),

  setCalendarEvents: (events) =>
    set((state) => {
      const { add, moved } = followCalendar(events, state.items, state.calendarHandled, state.today, clockHour(state.today));
      const items = moved.length
        ? state.items.map((item) => {
          const change = moved.find((m) => m.id === item.id);
          return change ? { ...item, ...change.patch } : item;
        })
        : state.items;
      // Google moved it: so did we, and you hear about it once.
      const fresh = moved.map((m) => {
        const now = items.find((item) => item.id === m.id)!;
        const when = now.deadline ? `Now due ${formatShort(now.deadline)}` : `Now ${formatShort(now.date)}${now.startHour === undefined ? '' : ` · ${formatHour(now.startHour)}`}`;
        return notice('📅', `${m.title} moved`, `/item/${m.id}`, when);
      });
      return {
        calendarEvents: events,
        items: add.length ? [...items, ...add] : items,
        ...(fresh.length ? { notices: [...fresh, ...state.notices].slice(0, 40) } : {}),
        ...(state.calendar ? { calendar: { ...state.calendar, lastSyncedAt: new Date().toISOString() } } : {}),
      };
    }),

  setUpCalendar: (key, template, events) =>
    set((state) => {
      const have = new Set(state.items.map((item) => item.id));
      const add = events.map((event) => itemFrom(event, template)).filter((item) => !have.has(item.id));
      return {
        items: [...state.items, ...add],
        calendarHandled: { ...state.calendarHandled, [key]: { as: 'added', template } },
      };
    }),

  skipCalendar: (keys) =>
    set((state) => ({
      calendarHandled: { ...state.calendarHandled, ...Object.fromEntries(keys.map((key) => [key, { as: 'skipped' as const }])) },
    })),

  unskipCalendar: (key) =>
    set((state) => {
      const { [key]: _gone, ...rest } = state.calendarHandled;
      return { calendarHandled: rest };
    }),

  calendarLaterToday: () => set((state) => ({ calendarLater: state.today })),

  connectSampleCalendar: () => {
    set({ calendar: sampleLink(new Date().toISOString()), calendarAvailable: true });
    get().setCalendarEvents(sampleCalendar(get().today));
  },

  setSampleCalendarsOn: (ids) => {
    const link = get().calendar;
    if (!link) return;
    set({ calendar: { ...link, calendars: link.calendars.map((cal) => ({ ...cal, on: ids.includes(cal.id) })) } });
    get().setCalendarEvents(sampleCalendar(get().today).filter((event) => ids.includes(event.calendar)));
  },

  forgetCalendar: () => set({ calendar: null, calendarEvents: [], calendarLater: null }),

  setGroupsFromServer: (dtos, me) =>
    set((state) => ({
      groups: dtos.filter((g) => g.you === 'member').map((g) => ({
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        owner: g.ownerId === me,
        members: g.people.filter((p) => p.status === 'member').map((p) => p.id),
        invited: g.people.filter((p) => p.status === 'invited').map((p) => ({ id: p.id, at: '' })),
        // Usual activities are yours, kept on the phone; the server keeps who is in it.
        activities: state.groups.find((old) => old.id === g.id)?.activities,
      })),
      groupInvites: dtos.filter((g) => g.you === 'invited').map((g) => ({
        id: g.id, name: g.name, emoji: g.emoji, from: g.invitedBy ?? 'A friend', at: '',
      })),
    })),


  goDemo: () =>
    set({
      mode: 'demo', account: null, today: TODAY,
      items: SEEDED.items, moods: moodHistory, meals: seedMeals, errands: seedErrands,
      contacts: seedContacts, recovery: recoveryLedger, modules: SEEDED.modules,
      circle: seedCircle, phoneContacts: seedPhoneContacts, customActions: seedCustomActions,
      requests: seedRequests, groupInvites: seedGroupInvites, received: seedReceived, notices: [],
      calendar: null, calendarAvailable: true, calendarEvents: [], calendarHandled: {}, calendarLater: null,
      booked: [], dayReports: [], invites: seedSent, moments: [], sleepHours: null, status: null, vibe: null,
      showEverythingAnyway: false, minimumViableWeek: false,
      ceilings: CEILINGS, overallCeiling: OVERALL_CEILING, sharing: 'evenings', offHour: 17,
      shareRules: DEFAULT_SHARE_RULES, customFlags: [], groups: seedGroups, planActivities: [],
    }),

  /**
   * Fold what the server sent into what is already here.
   *
   * Rows arriving here have already been through last-write-wins on the server,
   * so they are the agreed answer and win. Local rows the server has never heard
   * of are kept — those are writes still waiting in the queue, not deletions.
   */
  hydrate: (upserts, deletes) =>
    set((state) => {
      const patch: Partial<State> = {};
      const up = (name: Collection) => upserts.get(name) ?? [];
      const gone = (name: Collection) => deletes.get(name) ?? [];

      if (upserts.has('items') || deletes.has('items')) patch.items = mergeInto(state.items, up('items'), gone('items'));
      if (upserts.has('errands') || deletes.has('errands')) patch.errands = mergeInto(state.errands, up('errands'), gone('errands'));
      if (upserts.has('modules') || deletes.has('modules')) patch.modules = mergeInto(state.modules, up('modules'), gone('modules'));
      if (upserts.has('moods') || deletes.has('moods')) patch.moods = mergeInto(state.moods, up('moods'), gone('moods'));
      if (upserts.has('meals') || deletes.has('meals')) patch.meals = mergeInto(state.meals, up('meals'), gone('meals'));
      if (upserts.has('moments') || deletes.has('moments')) patch.moments = mergeInto(state.moments, up('moments'), gone('moments'));
      if (upserts.has('recovery') || deletes.has('recovery')) patch.recovery = mergeInto(state.recovery, up('recovery'), gone('recovery'));
      if (upserts.has('contacts') || deletes.has('contacts')) patch.contacts = mergeInto(state.contacts, up('contacts'), gone('contacts'));

      // Day reports key on the date rather than an id, so they merge by hand.
      if (upserts.has('dayReports')) {
        const incoming = new Map(up('dayReports').map((d) => [d.id, d.data as State['dayReports'][number]]));
        const kept = state.dayReports.filter((r) => !incoming.has(r.date));
        patch.dayReports = [...kept, ...incoming.values()].sort((a, b) => a.date.localeCompare(b.date));
      }

      // One document holding every preference, unpacked back into its fields.
      const settings = up('settings').find((d) => d.id === 'settings')?.data as Record<string, unknown> | undefined;
      if (settings) {
        if (settings.ceilings) patch.ceilings = settings.ceilings as State['ceilings'];
        if (typeof settings.overallCeiling === 'number') patch.overallCeiling = settings.overallCeiling;
        if (typeof settings.offHour === 'number') patch.offHour = settings.offHour;
        if (settings.sleepHours === null || typeof settings.sleepHours === 'number') patch.sleepHours = settings.sleepHours as number | null;
        if (Array.isArray(settings.booked)) patch.booked = settings.booked as string[];
        if (typeof settings.sharing === 'string') patch.sharing = settings.sharing as State['sharing'];
        if (Array.isArray(settings.customActions)) patch.customActions = settings.customActions as State['customActions'];
        if (typeof settings.onboarded === 'boolean') patch.onboarded = settings.onboarded;
        if (Array.isArray(settings.customFlags)) patch.customFlags = settings.customFlags as CustomFlag[];
        if (Array.isArray(settings.groups)) patch.groups = settings.groups as Group[];
        if (Array.isArray(settings.planActivities)) patch.planActivities = settings.planActivities as PlanActivity[];
        if (settings.status === null || typeof settings.status === 'string') patch.status = settings.status as string | null;
        if (settings.vibe === null || typeof settings.vibe === 'string') patch.vibe = settings.vibe as string | null;
        if (settings.shareRules && typeof settings.shareRules === 'object') {
          patch.shareRules = { ...DEFAULT_SHARE_RULES, ...(settings.shareRules as Partial<ShareRules>) };
        }
      }

      // Whatever arrived from an earlier day still unanswered is assumed done,
      // the same morning-after rule the seeded week follows.
      const items = patch.items ?? state.items;
      const modules = patch.modules ?? state.modules;
      const marked = autoMark(items, modules, state.today);
      if (marked.items !== items) {
        patch.items = marked.items;
        patch.modules = marked.modules;
      }

      return patch;
    }),

  setShowEverything: (value) => set({ showEverythingAnyway: value }),
  setMinimumViableWeek: (value) => set({ minimumViableWeek: value }),

  finishOnboarding: () => set({ onboarded: true }),

  /**
   * Booking recovery is a real write, not a navigation. It puts a protected
   * block in the week and credits the ledger in the same units as work, which
   * is the entire "rest is a debt you are owed" claim made operational.
   */
  bookRecovery: (prescription, startHour, hours, date) =>
    set((state) => {
      // One block per prescription. Booking the same walk twice is not two walks.
      if (state.booked.includes(prescription.id)) return {};
      // An hour of rest gives back the same everywhere, scaled by how long.
      const credit = Math.round(REST_LOAD_PER_HOUR * hours * 10) / 10;
      return {
        booked: [...state.booked, prescription.id],
        items: [
          ...state.items,
          {
            id: `recovery-${prescription.id}`,
            title: prescription.title,
            bucket: prescription.refills,
            hours,
            dread: 1,
            commitment: 'self',
            date: date ?? state.today,
            startHour,
            isRecovery: true,
            // An hour of real rest is worth more than an hour of work costs.
            // Left as hours x dread it came to minus one, which is nothing
            // against a ceiling of a hundred and sixty - so booking the thing
            // the app had just recommended moved the battery by less than a
            // percent. It is worth what the ledger says it is worth.
            loadOverride: -credit,
          },
        ],
        recovery: [
          {
            id: `booked-${prescription.id}`,
            label: prescription.title,
            detail: `Booked for ${formatHour(startHour)}${date && date !== state.today ? ` on ${date.slice(8)}` : ''}`,
            // The rest bank counts hours of rest.
            hours: Math.round(hours * 10) / 10,
            emoji: prescription.emoji ?? '🌿',
            tag: `Booked · ${formatHour(startHour)}`,
          },
          ...state.recovery,
        ],
      };
    }),

  /**
   * The simulator's plan, committed. Every action worth charge becomes a real
   * protected block in the week, so "what if I slept nine hours" turns into
   * something the forecast and the rebalancer can both see.
   */
  applyPlan: (blocks, sleepHours, date) =>
    set((state) => {
      const day = date ?? state.today;
      // A day has one plan, not a pile of them.
      //
      // Ids are stable per activity per day, but clearing only the ids in *this*
      // call left blocks from previous presses behind: booking a walk-only plan
      // after a walk-and-message one kept the message. The plan owns the whole
      // `plan-*` namespace for its day, so applying replaces it outright.
      const isPlanBlock = (id: string) => id.startsWith('plan-') && id.endsWith(`-${day}`);
      const ids = blocks.map((block) => `plan-${block.id}-${day}`);
      return {
        // Sleep is the night, not a block. It lands as a log and moves the
        // battery that way; it is never placed on a timeline.
        ...(sleepHours === undefined ? {} : { sleepHours }),
        items: [
          ...state.items.filter((item) => !isPlanBlock(item.id)),
          ...blocks.map((block) => planItem(block, day)),
        ],
        // The rest bank counts hours of rest, so only the rest goes in it.
        recovery: [
          ...blocks.flatMap((block, index) => (block.credit > 0 ? [{
            id: ids[index],
            label: block.label,
            detail: 'From tonight’s plan',
            hours: block.hours,
          }] : [])),
          ...state.recovery.filter((row) => !isPlanBlock(row.id)),
        ],
      };
    }),

  setOffHour: (hour) => set({ offHour: hour }),

  /**
   * You do not dread Tuesday, you dread networks.
   *
   * Dread belongs to the module, so setting it here re-prices every class in it
   * at once - which is the only way the number stays honest without asking for a
   * rating on all fourteen contact hours.
   */
  addModule: (module) => {
    const slug = module.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'module';
    const id = `mod-${slug}-${Date.now().toString(36)}`;
    set((state) => ({
      modules: [...state.modules, {
        id, name: module.name.trim(), code: (module.code ?? '').trim().toUpperCase() || module.name.trim().slice(0, 6).toUpperCase(),
        emoji: module.emoji, weeks: module.weeks, startDate: module.startDate, requiredAttendance: module.requiredAttendance,
        dread: module.dread ?? 2, importance: 2, attended: 0, held: 0,
      }],
    }));
    return id;
  },

  removeModule: (moduleId) =>
    set((state) => ({
      modules: state.modules.filter((m) => m.id !== moduleId),
      items: state.items.filter((item) => item.moduleId !== moduleId),
    })),

  addClass: (moduleId, slot) =>
    set((state) => {
      const module = state.modules.find((m) => m.id === moduleId);
      if (!module) return {};
      const taken = new Set(state.items.map((item) => item.id));
      const fresh = classItems(module, slot, state.today).filter((item) => !taken.has(item.id));
      return fresh.length ? { items: [...state.items, ...fresh] } : {};
    }),

  removeClass: (moduleId, day, startHour) =>
    set((state) => ({
      items: state.items.filter((item) => !(
        item.moduleId === moduleId && item.startHour === startHour && (new Date(`${item.date}T00:00:00Z`).getUTCDay() + 6) % 7 === day
      )),
    })),

  setModuleDread: (moduleId, dread) =>
    set((state) => ({
      modules: state.modules.map((m) => (m.id === moduleId ? { ...m, dread } : m)),
      items: state.items.map((item) => (item.moduleId === moduleId ? { ...item, dread } : item)),
    })),

  setModuleImportance: (moduleId, importance) =>
    set((state) => ({
      modules: state.modules.map((m) => (m.id === moduleId ? { ...m, importance } : m)),
    })),

  /**
   * Mark why an hour is worth more than its length.
   *
   * A flagged class is never proposed for moving: the lecture where the hints
   * get given is the one a stressed student is most likely to skip and least
   * able to afford to.
   */
  toggleClassFlag: (itemId, flag) =>
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== itemId) return item;
        const flags = item.flags ?? [];
        return { ...item, flags: flags.includes(flag) ? flags.filter((f) => f !== flag) : [...flags, flag] };
      }),
    })),

  /** A flag of your own, for one module. Returns its id so the class it was made on can wear it at once. */
  addCustomFlag: (flag) => {
    const id = customFlagId(flag.protect);
    const label = flag.label.trim().slice(0, 24);
    set((state) => ({ customFlags: [...state.customFlags, { ...flag, label, id }] }));
    return id;
  },

  /** Deleting a flag takes it off every class too - nothing keeps a reason that no longer exists. */
  removeCustomFlag: (id) =>
    set((state) => ({
      customFlags: state.customFlags.filter((f) => f.id !== id),
      items: state.items.map((item) =>
        item.flags?.includes(id) ? { ...item, flags: item.flags.filter((f) => f !== id) } : item,
      ),
    })),

  setShareRules: (patch) => set((state) => ({ shareRules: { ...state.shareRules, ...patch } })),

  setShareDay: (day, window) =>
    set((state) => ({
      shareRules: { ...state.shareRules, week: state.shareRules.week.map((w, i) => (i === day ? window : w)) },
    })),

  toggleHiddenFrom: (friendId) =>
    set((state) => {
      const hidden = state.shareRules.hiddenFrom;
      return {
        shareRules: {
          ...state.shareRules,
          hiddenFrom: hidden.includes(friendId) ? hidden.filter((id) => id !== friendId) : [...hidden, friendId],
        },
      };
    }),

  createGroup: (group) => {
    const id = `group-${Date.now()}`;
    set((state) => ({
      groups: [...state.groups, { ...group, id, name: group.name.trim().slice(0, 32) || 'New group', members: [...new Set(group.members)] }],
    }));
    return id;
  },

  updateGroup: (id, patch) =>
    set((state) => ({ groups: state.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

  toggleGroupMember: (groupId, friendId) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id !== groupId ? g : {
          ...g,
          members: g.members.includes(friendId) ? g.members.filter((m) => m !== friendId) : [...g.members, friendId],
        },
      ),
    })),

  deleteGroup: (id) => set((state) => ({ groups: state.groups.filter((g) => g.id !== id) })),

  addActivity: (activity, groupId) => {
    const id = `act-${Date.now()}`;
    const made: PlanActivity = {
      id,
      label: activity.label.trim().slice(0, 24) || 'Hang out',
      emoji: activity.emoji,
      hours: Math.max(0.5, Math.min(12, Math.round(activity.hours * 2) / 2)),
    };
    set((state) => (groupId
      ? { groups: state.groups.map((g) => (g.id === groupId ? { ...g, activities: [...(g.activities ?? []), made] } : g)) }
      : { planActivities: [...state.planActivities, made] }));
    return id;
  },

  removeActivity: (id, groupId) =>
    set((state) => (groupId
      ? { groups: state.groups.map((g) => (g.id === groupId ? { ...g, activities: (g.activities ?? []).filter((a) => a.id !== id) } : g)) }
      : { planActivities: state.planActivities.filter((a) => a.id !== id) })),

  markItem: (id, outcome, fraction) =>
    set((state) => {
      const result = applyMark(state.items, id, outcome, fraction);
      return {
        items: result.items,
        modules: result.register ? applyRegister(state.modules, [result.register]) : state.modules,
      };
    }),

  setModuleWeeks: (moduleId, weeks) =>
    set((state) => ({
      modules: state.modules.map((m) => (m.id === moduleId ? { ...m, weeks: Math.max(1, Math.min(30, Math.round(weeks))) } : m)),
    })),

  setModuleRequired: (moduleId, required) =>
    set((state) => ({
      modules: state.modules.map((m) => (m.id === moduleId ? { ...m, requiredAttendance: required } : m)),
    })),

  updateModule: (moduleId, patch) =>
    set((state) => ({ modules: state.modules.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)) })),

  setPic: (pic) => set({ pic }),
  snoozeMarks: () => set({ marksSnoozed: true }),
  startGuest: () => {
    useStore.getState().goDemo();
    set({ guest: true, onboarded: false });
  },
  endSession: () => {
    useStore.getState().goDemo();
    set({ guest: false, lastAccountId: null });
  },
  setSessionChecked: () => set({ sessionChecked: true }),

  /** Replace the timetable wholesale. A paste is an import, not an append. */
  importTimetable: (items, modules) =>
    set((state) => ({
      items: [...state.items.filter((item) => !item.moduleId), ...items],
      modules,
    })),

  addCustomAction: (action) =>
    set((state) => ({
      customActions: [...state.customActions.filter((a) => a.id !== action.id), action],
    })),

  removeCustomAction: (id) =>
    set((state) => ({ customActions: state.customActions.filter((a) => a.id !== id) })),

  /**
   * Move a day's sittings of one piece of work onto another day.
   *
   * "Push to tomorrow" used to move the deadline itself, which is the one thing
   * a student cannot do. It moves the work instead: the sittings go, the due
   * date stays where the world put it.
   */
  pushSittings: (parentId, from, to) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.parentId === parentId && item.date === from ? { ...item, date: to, startHour: undefined } : item,
      ),
    })),

  /** Throw the whole plan for a day away. One plan per day, and it is undoable. */
  clearPlan: (date) =>
    set((state) => {
      const isPlanBlock = (id: string) => id.startsWith('plan-') && id.endsWith(`-${date}`);
      return {
        items: state.items.filter((item) => !isPlanBlock(item.id)),
        recovery: state.recovery.filter((row) => !isPlanBlock(row.id)),
      };
    }),

  /** Reconnecting resets the gap. That is the only thing the social screen tracks. */
  markContacted: (id) =>
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? { ...c, lastSpokeDays: 0, state: 'talked' } : c)),
      // Messaging someone is what makes them one of your frequent people.
      circle: state.circle.map((p) => (p.id === id ? { ...p, frequency: (p.frequency ?? 0) + 1 } : p)),
    })),

  /** The one input that gives charge back rather than taking it. */
  logMoment: (kind, bucket, credit, note) =>
    set((state) => ({
      moments: [...state.moments, { id: `moment-${Date.now()}`, date: state.today, kind, bucket, credit, note }],
    })),

  /** Chipping away at a longer piece of work. Percent undone falls as this rises. */
  logProgress: (id, hours) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, prepDone: Math.min(item.prepHours ?? 0, Math.round(((item.prepDone ?? 0) + hours) * 10) / 10) }
          : item,
      ),
    })),

  /** Push it to another day. Losing a day is a decision, not a failure. */
  moveItem: (id, date) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, date } : item)),
    })),

  /**
   * Book sittings of a longer piece of work.
   *
   * `replace` is for re-planning from scratch: the sittings still ahead go and
   * the new plan takes their place. The ones already done stay - they are what
   * moved the bar, and deleting them is how a day forgot it had happened.
   */
  scheduleSessions: (parentId, sessions, options) =>
    set((state) => {
      const parent = state.items.find((item) => item.id === parentId);
      if (!parent) return {};
      const kept = options?.replace
        ? state.items.filter((item) => item.parentId !== parentId || item.sessionDone)
        : state.items;
      const existing = kept.filter((item) => item.parentId === parentId).length;
      return {
        items: [
          ...kept,
          ...sessions.map((session, index) => ({
            id: `session-${parentId}-${Date.now()}-${existing + index}`,
            title: parent.title,
            bucket: parent.bucket,
            hours: session.hours,
            dread: parent.dread,
            commitment: parent.commitment,
            date: session.date,
            startHour: session.startHour,
            parentId,
            note: session.note,
            // A sitting costs what the whole piece costs, in the same places.
            mix: parent.mix,
          })),
        ],
      };
    }),

  /** Giving a sitting back. The unplanned part of the bar grows again. */
  unscheduleSession: (sessionId) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== sessionId) })),

  /**
   * Move a booked sitting, or change how long it is.
   *
   * Giving it back and booking again lost the note and reshuffled the list; a
   * sitting you want on Wednesday instead is the same sitting. A done one stays
   * where it happened.
   */
  updateSession: (sessionId, patch) =>
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== sessionId || !item.parentId || item.sessionDone) return item;
        const hours = patch.hours !== undefined ? Math.max(0.5, Math.round(patch.hours * 2) / 2) : item.hours;
        return {
          ...item,
          date: patch.date ?? item.date,
          startHour: 'startHour' in patch ? patch.startHour : item.startHour,
          hours,
        };
      }),
    })),

  setSessionNote: (sessionId, note) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === sessionId ? { ...item, note } : item)),
    })),

  /**
   * Tick a sitting off, and the work it belongs to moves forward by its hours.
   *
   * This is the whole progress mechanism. Dragging a percentage asked the
   * student to estimate something they do not know; "I did the two hours I
   * booked on Tuesday" is something they do.
   */
  completeSitting: (sessionId) =>
    set((state) => {
      const session = state.items.find((item) => item.id === sessionId);
      if (!session || session.sessionDone || !session.parentId) return {};
      return { items: applyMark(state.items, sessionId, 'done').items };
    }),

  /** Work done without booking a sitting first, which happens. */
  logUnbookedHours: (id, hours) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, prepDone: Math.round(Math.min(item.prepHours ?? 0, (item.prepDone ?? 0) + hours) * 10) / 10 }
          : item,
      ),
    })),

  /** One tap on waking. The battery moves before you put the phone down. */
  /**
   * Last night, in both places it belongs: the battery (through today's log)
   * and the rest bank, where a short night is rest owed and a long one is
   * rest banked - against the same seven hours the battery uses.
   */
  logSleep: (hours) =>
    set((state) => {
      const id = `sleep-${state.today}`;
      const kept = state.recovery.filter((row) => row.id !== id);
      const banked = Math.round((hours - SLEEP_TARGET) * 10) / 10;
      return {
        sleepHours: hours,
        recovery: banked === 0 ? kept : [
          { id, label: 'Last night', detail: `${hours}h of sleep`, hours: banked, emoji: '😴', tag: `${hours}h slept` },
          ...kept,
        ],
      };
    }),

  /**
   * Proposing a gathering puts it in your own week straight away. Seeing people
   * is load like anything else - pleasant load, but it still occupies an evening,
   * and hiding that would be the same lie every other planner tells.
   */
  sendInvite: (invite) =>
    set((state) => {
      // The same people, the same evening, twice, is one gathering.
      const duplicate = state.invites.some(
        (existing) =>
          existing.date === invite.date &&
          existing.startHour === invite.startHour &&
          existing.people.join() === invite.people.join(),
      );
      if (duplicate) return {};
      const id = invite.id ?? `invite-${invite.date}-${invite.startHour}-${invite.people.join('-')}`;
      return {
        // An invitation, not yet a plan: it goes in your week when you say so,
        // usually once the people you asked have said yes.
        invites: [...state.invites, { ...invite, id, answers: invite.answers ?? {}, sentAt: new Date().toISOString() }],
        // Planning with people is the other thing that makes them frequent.
        circle: state.circle.map((p) => (invite.people.includes(p.id) ? { ...p, frequency: (p.frequency ?? 0) + 1 } : p)),
      };
    }),

  scheduleInvite: (id) =>
    set((state) => {
      const invite = state.invites.find((i) => i.id === id);
      if (!invite || state.items.some((item) => item.id === id)) return {};
      // Only a plan everyone said yes to is a plan; until then it is still a question.
      if (!invite.people.every((person) => invite.answers?.[person] === 'yes')) return {};
      return {
        invites: state.invites.map((i) => (i.id === id ? { ...i, scheduled: true } : i)),
        items: [...state.items, planAsItem(invite)],
      };
    }),

  cancelInvite: (id) =>
    set((state) => ({
      invites: state.invites.filter((i) => i.id !== id),
      items: state.items.filter((item) => item.id !== id),
    })),

  answerReceived: (id, yes) =>
    set((state) => {
      const invite = state.received.find((r) => r.id === id);
      if (!invite) return {};
      const itemId = `going-${id}`;
      return {
        received: state.received.map((r) => (r.id === id ? { ...r, answer: yes ? 'yes' as const : 'no' as const } : r)),
        items: yes
          ? [...state.items.filter((item) => item.id !== itemId), planAsItem({ ...invite, id: itemId })]
          : state.items.filter((item) => item.id !== itemId),
      };
    }),

  setInvitesFromServer: (dtos, me) =>
    set((state) => ({
      invites: dtos.filter((d) => d.fromMe).map((d) => ({
        id: d.id, title: d.title, date: d.date, startHour: d.startHour, hours: d.hours,
        people: d.guests.map((g) => g.id),
        answers: Object.fromEntries(d.guests.filter((g) => g.response !== 'pending').map((g) => [g.id, g.response as 'yes' | 'no'])),
        scheduled: state.items.some((item) => item.id === d.id),
        groupId: state.invites.find((i) => i.id === d.id)?.groupId,
      })),
      received: dtos.filter((d) => !d.fromMe).map((d) => {
        const mine = d.guests.find((g) => g.id === me)?.response;
        return {
          id: d.id, title: d.title, date: d.date, startHour: d.startHour, hours: d.hours, from: d.host.name,
          others: d.guests.filter((g) => g.id !== me).map((g) => ({ id: g.id, name: g.name, ...(g.response === 'pending' ? {} : { answer: g.response as 'yes' | 'no' }) })),
          ...(mine && mine !== 'pending' ? { answer: mine as 'yes' | 'no' } : {}),
        };
      }),
    })),

  /**
   * "Actually, I'm going." Going is not the wrong answer, so the week re-plans
   * around it: the kept item stays and a self-imposed one moves to Sunday.
   */
  keepItem: (_id, pushId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === pushId ? { ...item, date: addDays(item.date, 7 - ((new Date(`${item.date}T00:00:00Z`).getUTCDay() + 6) % 7) - 1) } : item,
      ),
    })),

  /**
   * One evening's answer. Two things move, and they are separate on purpose:
   * `felt` lowers your ceilings, `verdict` re-weights the ranking.
   */
  reportDay: (felt, percent, verdict) =>
    set((state) => ({ dayReports: [...state.dayReports, { date: state.today, felt, percent, verdict }] })),

  logMood: (quadrant, tags) =>
    set((state) => ({
      moods: [
        { id: `mood-${Date.now()}`, date: state.today, at: 'Just now', quadrant, tags },
        ...state.moods,
      ],
    })),

  // A signed-in week starts with no meals, so the first answer adds the meal.
  setMealStatus: (id, status) =>
    set((state) => ({ meals: upsertMeal(state.meals, id, status) })),

  /**
   * Ticking one off. Yours stops costing you; a seeded one pays out its weight
   * as a credit, so finishing something always moves the number.
   */
  toggleErrand: (id) =>
    set((state) => {
      const errand = state.errands.find((e) => e.id === id);
      if (!errand) return {};
      const credit = completionCredit(errand);
      const momentId = `errand-done-${id}`;
      return {
        errands: state.errands.map((e) => (e.id === id ? { ...e, done: !e.done } : e)),
        moments: errand.done
          ? state.moments.filter((m) => m.id !== momentId)
          : credit > 0
            ? [...state.moments, { id: momentId, date: state.today, kind: 'errand-done', bucket: 'errands' as const, credit, note: errand.title }]
            : state.moments,
      };
    }),

  /**
   * One list for everything you just do.
   *
   * Whether it arrives from the errands screen or from capture as a thing you
   * only have to turn up to, it is the same kind of object and lands in the same
   * place - so it shows up on its day *and* in the list, rather than one or the
   * other depending on where it was typed.
   */
  addErrand: (title, category, hours, effort, when, bucket, mix, want) =>
    set((state) => ({
      errands: [
        { id: `errand-${Date.now()}`, title, category, done: false, hours, effort, addedByUser: true, bucket, mix, want, ...when },
        ...state.errands,
      ],
    })),

  /**
   * Give a floating task a slot, or take one away.
   *
   * The point of separating scheduled from unscheduled is that you can act on
   * it: an hour of coursework with nowhere to go is the thing that quietly slides
   * to midnight, and this is how it stops.
   */
  scheduleItem: (id, startHour) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, startHour } : item)),
    })),

  /** Not communicated -> talked -> saw -> not communicated. One tap, three states. */
  cycleContact: (id) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === id
          ? { ...c, state: c.state === 'none' ? 'talked' : c.state === 'talked' ? 'saw' : 'none', lastSpokeDays: c.state === 'none' ? 0 : c.lastSpokeDays }
          : c,
      ),
    })),

  /** Back to the seeded semester. The intro stays done - resetting is not a punishment. */
  reset: () =>
    set({
      items: SEEDED.items, showEverythingAnyway: false, minimumViableWeek: false,
      moods: moodHistory, meals: seedMeals, errands: seedErrands, contacts: seedContacts,
      recovery: recoveryLedger, booked: [], dayReports: [],
      sleepHours: null, invites: seedSent, moments: [], offHour: 17, customActions: seedCustomActions, modules: SEEDED.modules,
      circle: seedCircle, phoneContacts: seedPhoneContacts, sharing: 'evenings',
      shareRules: DEFAULT_SHARE_RULES, customFlags: [], groups: seedGroups, planActivities: [],
      requests: seedRequests, groupInvites: seedGroupInvites, received: seedReceived, notices: [],
      calendar: null, calendarEvents: [], calendarHandled: {}, calendarLater: null,
      // Ceilings too. They move when you report a hard day below your line, and
      // reset clears the day reports that moved them - leaving the lowered line
      // in place with the evidence for it gone made every later reading read
      // worse than the seeded semester it claims to restore.
      ceilings: CEILINGS, overallCeiling: OVERALL_CEILING,
    }),
    }),
    {
      name: STORAGE_KEY,
      storage,
      /**
       * What survives a reload.
       *
       * Always: whether setup has run, your picture, and your note - facts about
       * you. A signed-in week lives on the server and comes back through sync.
       * A guest's week has nowhere else to live, so it is kept here too: a task
       * added, a class marked or a night planned is still there after a
       * refresh, the way it would be in a real app. "Reset the sample week"
       * in Settings starts it fresh whenever you want.
       */
      partialize: (state) => ({
        onboarded: state.onboarded, pic: state.pic, guest: state.guest, lastAccountId: state.lastAccountId,
        status: state.status, vibe: state.vibe, seenNotices: state.seenNotices,
        calendar: state.calendar, calendarAvailable: state.calendarAvailable, calendarEvents: state.calendarEvents,
        calendarHandled: state.calendarHandled, calendarLater: state.calendarLater,
        ...(state.guest ? {
          items: state.items, errands: state.errands, modules: state.modules, moods: state.moods,
          meals: state.meals, moments: state.moments, recovery: state.recovery, contacts: state.contacts,
          dayReports: state.dayReports, ceilings: state.ceilings, overallCeiling: state.overallCeiling,
          offHour: state.offHour, sleepHours: state.sleepHours, booked: state.booked, sharing: state.sharing,
          shareRules: state.shareRules, customActions: state.customActions, customFlags: state.customFlags,
          groups: state.groups, planActivities: state.planActivities, invites: state.invites, circle: state.circle,
          requests: state.requests, groupInvites: state.groupInvites, received: state.received, notices: state.notices, phoneContacts: state.phoneContacts,
        } : {}),
      }) as unknown as State,
      /**
       * Bump this whenever a fix changes what a *saved* week can contain.
       *
       * De-duplication and the sleep-is-not-a-block rule only stop new bad data;
       * a phone that had already stacked three walks at 7am, or written a "Sleep
       * tonight" block, would carry them forever. Raising the version drops the
       * old save and starts from the seeded semester again.
       */
      version: SCHEMA_VERSION,
      migrate: (persisted, from) => migrateSaved<State>(persisted, from) as State,
    },
  ),
);

// ---------------------------------------------------------------- selectors
// Kept as plain functions rather than hooks so the same maths is reachable from
// tests, the seed checker and the components without a React tree.

export const itemsInWeek = (items: Item[], anchor: string): Item[] =>
  items.filter((i) => isSameWeek(i.date, anchor));

export const itemsOnDay = (items: Item[], day: string): Item[] =>
  items.filter((i) => i.date === day && !i.spread);

export function weekReading(items: Item[], anchor: string, ceilings: Record<BucketKey, number>) {
  const week = itemsInWeek(countedOnce(items), anchor);
  const percents = percentByBucket(week, ceilings);
  return { week, percents, overall: overallOf(week, ceilings) };
}

export const nextWeek = (anchor: string): string => addDays(anchor, 7);

/**
 * Your ceiling moves. Report a day as hard at a percentage below your current
 * line twice and that becomes the new line - the daily tap on the widget is the
 * only input, and this is where it lands.
 */
export const liveCeiling = (
  base: number,
  reports: Array<{ felt: 'fine' | 'meh' | 'hard'; percent: number }>,
): number => recalibrate(base, reports.filter((r) => r.felt === 'hard').map((r) => r.percent));

/** Hours of rest owed, from the live ledger rather than the seed constant. */
export const restOwedFrom = (rows: RecoveryEntry[]): number =>
  Math.abs(Math.round(rows.reduce((total, row) => total + (row.hours ?? 0), 0)));

/** Everything movable this week, largest saving first. Hard deadlines never appear. */
export const movableIn = (items: Item[]): Item[] =>
  items.filter(isMovable).sort((a, b) => loadOf(b) - loadOf(a));
