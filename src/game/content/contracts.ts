// The notice board at Lanternhold. Contracts are the economy's faucet: they
// put runes into the world for work that would otherwise only cost you flasks.

import { ENEMIES } from './enemies';
import { ITEMS } from './items';
import { mulberry32 } from '../core';

export interface Contract {
  id: string;
  kind: 'kill' | 'fetch';
  target: string;
  need: number;
  title: string;
  posted: string;
  runes: number;
  reward?: { id: string; qty: number };
}

interface KillTemplate { target: string; title: string; posted: string; min: number; max: number }

const KILL_JOBS: KillTemplate[] = [
  { target: 'wolf', min: 4, max: 7, title: 'Wolves on the Moor Road', posted: 'They have learned which way the carts go. Four of them would be a mercy; six would be a message.' },
  { target: 'hollow', min: 6, max: 10, title: 'Clearing the Fen Paths', posted: 'They do not hunt. They simply walk where they walked, and the paths are where they walked. — Roderic' },
  { target: 'fenhound', min: 4, max: 7, title: 'Something in the Reeds', posted: 'Ilsa has been three hours getting close to it twice now. Pay is for the pelts, not the patience.' },
  { target: 'redhand', min: 3, max: 6, title: 'The Road Is Not Theirs', posted: 'Bandits want things. These want the road. Take it back off them a few at a time.' },
  { target: 'ghoul', min: 5, max: 8, title: 'The Fourth Niche Is Empty', posted: 'Whoever is letting them out of the catacombs can answer for it later. First, the ones already out.' },
  { target: 'boar', min: 3, max: 5, title: 'Black Boar, Fen Side', posted: 'It has had two dogs and a gate. Wren wants the hide; the rest of us want it finished.' },
  { target: 'wraith', min: 3, max: 5, title: 'Lights on the Moor', posted: 'They gather where lamps have gone out. The Bellkeeper would like to know how many there are now.' },
  { target: 'beastman', min: 2, max: 4, title: 'Rotwood Bounty', posted: 'Do not go in alone. That is advice, not a condition of payment. — Ilsa' },
  { target: 'drowned', min: 4, max: 6, title: 'The Lowlands Queue', posted: 'They are waiting their turn in a queue that no longer moves. Move them.' },
  { target: 'choirman', min: 2, max: 4, title: 'Silence, Partial', posted: 'The Reach will not thank you and the singing will not stop. Paid anyway.' },
];

interface FetchTemplate { target: string; title: string; posted: string; min: number; max: number }

const FETCH_JOBS: FetchTemplate[] = [
  { target: 'beast_bone', min: 4, max: 8, title: 'Bone for the Forge', posted: 'Hasket wants the long ones. He will not say what for and I have stopped asking. — Tobin' },
  { target: 'wolf_pelt', min: 3, max: 5, title: 'Pelts Before Frost', posted: 'Three would see the children through. Five and I will owe you something better than coin. — Ilsa' },
  { target: 'emberglass', min: 5, max: 9, title: 'Glass From The Barrens', posted: 'Found by the cartload out there, which ought to frighten you. Bring it anyway.' },
  { target: 'pale_ash', min: 3, max: 6, title: 'Ash That Will Not Blow Away', posted: 'The Bellkeeper collects it. He has not said why and I have decided not to want to know.' },
  { target: 'fen_salt', min: 4, max: 8, title: 'Salt From The Dry Crust', posted: 'Where the water has gone and not come back. Scrape it, bag it, bring it.' },
  { target: 'grave_wax', min: 2, max: 4, title: 'Wax For The Long Night', posted: 'Burns past when it should have guttered. We are going to need that. — Maren' },
  { target: 'hollow_tooth', min: 3, max: 6, title: 'Teeth, Clean, Root And All', posted: 'They grow back. That is not a reason to be squeamish; it is a reason to hurry.' },
  { target: 'drowned_coin', min: 3, max: 6, title: 'Coin Of No Known Reign', posted: 'I take them at face value. Do not ask me what face. — Tobin' },
];

const PAYOUT_ITEMS = ['bloodwort_tonic', 'whetstone', 'ash_resin', 'firebomb', 'emberglass', 'throwing_knife'];

/** Three contracts, regenerated deterministically each cycle. */
export function rollContracts(seed: number, cycle: number, tier: number): Contract[] {
  const r = mulberry32((seed ^ (cycle * 2654435761)) >>> 0);
  const out: Contract[] = [];
  const usedKill = new Set<string>();
  const usedFetch = new Set<string>();

  const makeKill = (): Contract | null => {
    const pool = KILL_JOBS.filter(j => !usedKill.has(j.target) && (ENEMIES[j.target]?.tier ?? 0) <= tier + 1);
    if (!pool.length) return null;
    const j = pool[Math.floor(r() * pool.length)];
    usedKill.add(j.target);
    const need = j.min + Math.floor(r() * (j.max - j.min + 1));
    const e = ENEMIES[j.target];
    const runes = Math.round(need * (e?.runes ?? 40) * (2.2 + r() * 0.8));
    return { id: `k_${cycle}_${j.target}`, kind: 'kill', target: j.target, need, title: j.title, posted: j.posted, runes };
  };
  const makeFetch = (): Contract | null => {
    const pool = FETCH_JOBS.filter(j => !usedFetch.has(j.target) && ITEMS[j.target]);
    if (!pool.length) return null;
    const j = pool[Math.floor(r() * pool.length)];
    usedFetch.add(j.target);
    const need = j.min + Math.floor(r() * (j.max - j.min + 1));
    const runes = Math.round(need * (ITEMS[j.target]?.value ?? 40) * (1.6 + r() * 0.6));
    return { id: `f_${cycle}_${j.target}`, kind: 'fetch', target: j.target, need, title: j.title, posted: j.posted, runes };
  };

  for (const make of [makeKill, makeFetch, r() < 0.5 ? makeKill : makeFetch]) {
    const c = make();
    if (!c) continue;
    if (r() < 0.45) c.reward = { id: PAYOUT_ITEMS[Math.floor(r() * PAYOUT_ITEMS.length)], qty: 1 + Math.floor(r() * 2) };
    out.push(c);
  }
  return out;
}

export const CONTRACT_CYCLE = 900; // play-seconds before the board is reposted
