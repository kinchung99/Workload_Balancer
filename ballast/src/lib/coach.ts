/**
 * What the AI coach is shown, built from what the phone already worked out.
 *
 * Each of these takes a list the app made itself from what the student
 * entered - the ranking, the priced trades - and trims it to the fields the
 * contract allows. The model only explains and chooses among the ids here, so
 * its answer can only ever point at something the app can already do.
 */
import { addDays, formatShort } from './dates';
import { formatHour } from './schedule';
import { percentUndone, remaining } from './prep';
import { wireCommitment } from './load';
import type { PriorityContext, RebalanceContext } from '@shared/contract';
import type { Ranked } from './priority';
import type { Item, Trade } from './types';

const title = (text: string): string => text.trim().slice(0, 80) || 'Untitled';
const dread = (value: number): number => Math.max(1, Math.min(5, Math.round(value)));

/** "today", "tomorrow", "Thu 13 Nov". */
export const dueWord = (date: string, today: string): string =>
  date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : formatShort(date);

/** The top of the ranked list, as the AI may see it. */
export function priorityContext(rows: Ranked[], today: string, hour: number, charge: number, restOwed: number): PriorityContext {
  return {
    now: `${formatShort(today)}, ${formatHour(Math.min(23.5, Math.round(hour * 2) / 2))}`,
    charge: Math.max(0, Math.min(100, Math.round(charge))),
    restOwed: Math.max(0, Math.min(200, restOwed)),
    tasks: rows.slice(0, 10).map(({ item, kind }) => ({
      id: item.id,
      title: title(item.title),
      kind,
      due: dueWord(item.deadline ?? item.date, today),
      hoursLeft: Math.min(300, kind === 'owing' ? remaining(item) : item.hours),
      ...(kind === 'owing' ? { percentLeft: percentUndone(item) } : {}),
      dread: dread(item.dread),
      hardness: wireCommitment(item.commitment),
    })),
  };
}

/** Next week's trades, as the AI may see them - locked ones too, so it can say why not. */
export function rebalanceContext(
  trades: Trade[], byId: Record<string, Item>, charge: number, swap?: RebalanceContext['swap'],
): RebalanceContext {
  return {
    charge: Math.max(0, Math.min(100, Math.round(charge))),
    options: trades.slice(0, 16).map((trade) => {
      const item = byId[trade.itemId.split(',')[0]];
      return {
        id: trade.id,
        title: title(trade.title),
        detail: trade.detail.slice(0, 140),
        saves: Math.max(0, Math.min(500, Math.round(trade.saves * 10) / 10)),
        day: item ? formatShort(item.date) : 'next week',
        locked: !!trade.locked,
        protected: !!trade.protected,
      };
    }),
    ...(swap ? { swap: { keep: title(swap.keep), drop: title(swap.drop), day: swap.day } } : {}),
  };
}
