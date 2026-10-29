// Chapter spine. Objectives are checked against game state each frame, so the
// tracker updates without quest-giver bookkeeping.

export interface Chapter {
  id: string;
  n: number;
  title: string;
  /** Shown in the objective tracker. */
  goal: string;
  /** Longer text in the journal. */
  brief: string;
  /** Site id to point the compass at, if any. */
  site?: string;
  /** Flag that completes this chapter. */
  done: string;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'wake', n: 0, title: 'Prologue: The Lamp With Your Name In It',
    goal: 'Speak to Elder Maren in Lanternhold.',
    brief: 'You woke on the stones of Lanternhold with no memory of lying down. The lamp in the plaza is lit. Somebody has been keeping it.',
    site: 'hub', done: 'talked_elder',
  },
  {
    id: 'choir', n: 1, title: 'I. The Singing Under The Water',
    goal: 'Silence whatever holds the note in the Cathedral of the Drowned Choir.',
    brief: 'The Reach lies north. In its cathedral the Drowned Choir has held a single note since the flood, and the lamps along that arm of the valley have all gone out. Maren wants it stopped. The Bellkeeper would rather you understood it first.',
    site: 'choir', done: 'boss_choir',
  },
  {
    id: 'bride', n: 2, title: 'II. The Hall That Is Still Set For Dinner',
    goal: 'Find the Pale Hall in the Lowlands and end Vaelith\'s wait.',
    brief: 'Vaelith of the Pale Hall was promised to the Crown at the turn of the low water. The Crown did not come. She is still dressed for it, and the Lowlands have gone under around her.',
    site: 'bride', done: 'boss_bride',
  },
  {
    id: 'forge', n: 3, title: 'Optional: The Arm That Will Not Stop',
    goal: 'The Ember Forge keeps a smith who has been working for nine hundred years.',
    brief: 'Hasket keeps the front of the forge. Behind the door is whoever kept it before him, still going through the motion of making something.',
    site: 'forge', done: 'boss_emberwright',
  },
  {
    id: 'crown', n: 4, title: 'III. He Who Put Out The Lamps',
    goal: 'Climb to the Hollow Crown in the Highlands.',
    brief: 'The First Hollow sits where the last lamp was extinguished, under a crown that weighs nothing. He asked what we were keeping back. He was right about the answer and it has not helped anybody since.',
    site: 'first', done: 'boss_first',
  },
  {
    id: 'end', n: 5, title: 'IV. Two Doors',
    goal: 'Return to the First Lamp in Lanternhold and decide.',
    brief: 'Wear the crown and keep the valley lit for as long as you can bear to. Or put out the First Lamp and let the whole thing finish.',
    site: 'hub', done: 'ended',
  },
];

export type FlagSet = Record<string, boolean>;

export function currentChapter(flags: FlagSet) {
  for (const c of CHAPTERS) if (!flags[c.done] && c.id !== 'forge') return c;
  return CHAPTERS[CHAPTERS.length - 1];
}

export const ENDINGS = {
  crown: {
    id: 'crown', title: 'THE LAMPS STAY LIT',
    text: 'You put the crown on. It weighs nothing, exactly as advertised.\n\nThe valley comes back one lamp at a time, and you walk the round, and at dawn you start again, and you will start again tomorrow and for as long as you can stand to want anything at all.\n\nThe Bellkeeper rings the hour. You are still there to hear it. That is the arrangement. That was always the arrangement.',
  },
  dark: {
    id: 'dark', title: 'HOLLOWMERE GOES OUT',
    text: 'You put out the First Lamp.\n\nIt takes a moment longer than you expect. Then the plaza is dark, and the fen is dark, and somewhere north the Cathedral stops being a cathedral and becomes a building full of water.\n\nNothing comes through the door, because there was never anything on the other side. The valley is simply allowed, after nine hundred years, to be finished.\n\nSo are you.',
  },
  abandon: {
    id: 'abandon', title: 'YOU WALK OUT',
    text: 'You leave the crown where it fell and take the south road, and you keep taking it, and the fen gives way to fen and then to fen.\n\nEvery road out of Hollowmere goes further into Hollowmere. Tobin checked. Twice.\n\nBehind you, someone lights a lamp.',
  },
} as const;
export type EndingId = keyof typeof ENDINGS;
