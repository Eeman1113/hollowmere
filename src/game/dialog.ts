import { ITEMS, NPCS, QUESTS, type NpcId } from './data';
import { addItem, countItem, removeItem } from './state';
import type { GameScene } from './scenes/GameScene';

export interface DialogOption { label: string; act: () => DialogNode | null | 'shop' }
export interface DialogNode { text: string; options: DialogOption[] }

const bye: DialogOption = { label: 'Farewell.', act: () => null };

function questOffer(g: GameScene, qid: string, pitch: string, back: () => DialogNode): DialogOption[] {
  const P = g.P, q = QUESTS[qid], st = P.quests[qid];
  if (st.status === 'none') {
    return [{
      label: `[Quest] ${q.title}`,
      act: () => ({
        text: pitch,
        options: [
          { label: 'I\'ll do it.', act: () => { st.status = 'active'; st.progress = 0; g.ui.log(`Quest started: ${q.title}`, '#e8c878'); return { text: 'Thank you. Be careful out there.', options: [{ label: 'Back', act: back }, bye] }; } },
          { label: 'Not now.', act: back },
        ],
      }),
    }];
  }
  if (st.status === 'active') {
    const have = q.kind === 'fetch' ? countItem(P, q.target) : st.progress;
    if (have >= q.count) {
      return [{
        label: `[Complete] ${q.title}`,
        act: () => {
          if (q.kind === 'fetch') removeItem(P, q.target, q.count);
          st.status = 'done';
          if (q.reward.gold) P.gold += q.reward.gold;
          for (const [id, n] of q.reward.items ?? []) { addItem(P, id, n); g.ui.log(`Received ${n > 1 ? n + 'x ' : ''}${ITEMS[id].name}.`, '#ffe080'); }
          g.ui.log(`Quest complete: ${q.title}${q.reward.gold ? ` (+${q.reward.gold} gold)` : ''}`, '#ffe080');
          g.gainXp(q.reward.xp);
          if (qid === 'relic') { P.won = true; g.ui.showVictory(); }
          g.save(true);
          return { text: completeLine(qid), options: [{ label: 'Back', act: back }, bye] };
        },
      }];
    }
    return [{ label: `[Progress] ${q.title} (${have}/${q.count})`, act: () => ({ text: progressLine(qid), options: [{ label: 'Back', act: back }, bye] }) }];
  }
  return [];
}

function completeLine(qid: string) {
  return ({
    wolves: 'Five fewer wolves at our door. The village owes you. Take this gold.',
    pelts: 'Fine pelts! I stitched this leather armor last winter — it is yours.',
    herbs: 'Wonderful, these are fresh. Here, two tonics for your troubles.',
    bandits: 'Ha! The Redhand gang will think twice. Take my old sword, soldier.',
    relic: 'The Heart... it stops beating. Can you feel it? The air is lighter already. Hollowmere is saved — and this blade, forged long ago for this day, is yours.',
  } as Record<string, string>)[qid];
}
function progressLine(qid: string) {
  return ({
    wolves: 'The wolves roam the forests, thickest at night. Come back when five are dead.',
    pelts: 'Wolves, mostly in the deep woods. Skin them and bring me the pelts.',
    herbs: 'Look for purple flowers growing wild in the woods and meadows.',
    bandits: 'Their camp lies north-east, along the road. They wear red insignias.',
    relic: 'The chapel ruins lie to the north-west. Gather your strength first — bandages, tonics, a real weapon.',
  } as Record<string, string>)[qid];
}

export function dialogFor(g: GameScene, id: NpcId): DialogNode {
  const P = g.P;
  const root = () => dialogFor(g, id);
  const name = NPCS[id].name;
  switch (id) {
    case 'elder': {
      const opts: DialogOption[] = [...questOffer(g, 'wolves', 'Wolves have been circling the village each night, bolder than ever. Something drives them from the north-west. Thin their numbers — slay five, and I will reward you.', root)];
      if (P.quests.wolves.status === 'done' || P.quests.relic.status !== 'none') opts.push(...questOffer(g, 'relic', 'You have proven yourself. The truth: a blight called the Hollow spreads from the old chapel in the north-west. Its knight guards a cursed heart. Destroy it, bring me the heart, and the valley may yet heal.', root));
      opts.push({ label: 'Tell me about Hollowmere.', act: () => ({ text: 'A quiet valley, once. Farms, a trading road, a chapel on the hill. Then the Hollow came. Now wraiths walk at night and the beasts have gone mad. We survive. Eat, drink, rest, and never wander the woods at night unprepared.', options: [{ label: 'Back', act: root }, bye] }) });
      opts.push(bye);
      return { text: P.won ? `${name}: "Our hero returns! The valley breathes again thanks to you."` : `${name}: "Ah, you're awake. These are dark days, friend. We need every able hand."`, options: opts };
    }
    case 'captain': {
      const opts: DialogOption[] = [...questOffer(g, 'bandits', 'The Redhand gang has set up camp to the north-east, raiding our caravans. Bring me four of their insignias as proof you\'ve thinned their ranks, and I\'ll arm you properly.', root)];
      opts.push({ label: 'Any advice for a fighter?', act: () => ({ text: 'Keep your stamina up — a tired swing is half a swing. Shift to sprint, but not into a fight. Wolves hunt in packs: hit one and the rest come. Bleeding? Bandage it, fast. And bandits hit hard; wear armor.', options: [{ label: 'Back', act: root }, bye] }) });
      opts.push(bye);
      return { text: `${name}: "Halt. Oh — it's you. Keep your blade sharp, the roads aren't safe."`, options: opts };
    }
    case 'merchant': return {
      text: `${name}: "Welcome, welcome! Bread, bottles, blades — Tobin has it all. And I buy anything worth a coin."`,
      options: [{ label: 'Let me see your wares.', act: () => 'shop' }, bye],
    };
    case 'hunter': {
      const opts: DialogOption[] = [...questOffer(g, 'pelts', 'Winter\'s coming and the village needs warm coats. Bring me three wolf pelts and I\'ll give you the leather armor I made last year.', root)];
      opts.push({ label: 'Hunting tips?', act: () => ({ text: 'Deer flee — sneak close or corner them. Boars mind their own business, until you hit one. Raw meat must be cooked on a campfire: three logs and two stones. Craft one with [C].', options: [{ label: 'Back', act: root }, bye] }) });
      opts.push(bye);
      return { text: `${name}: "Quiet. You'll scare the game... Ah, what do you need?"`, options: opts };
    }
    case 'herbalist': {
      const opts: DialogOption[] = [...questOffer(g, 'herbs', 'My stores are nearly empty and folk keep getting hurt. Could you gather five bundles of wild herbs? The purple ones.', root)];
      const ecto = countItem(P, 'ecto');
      if (ecto) opts.push({ label: `Sell wraith essence (${ecto}) for ${ecto * 18} gold`, act: () => { removeItem(P, 'ecto', ecto); P.gold += ecto * 18; return { text: 'Cold as the grave... I can make a ward from this. Thank you.', options: [{ label: 'Back', act: root }, bye] }; } });
      opts.push({ label: 'What can I brew?', act: () => ({ text: 'At a campfire: three herbs and water make a Healing Tonic. Two herbs and water make Bitter Root Tea, which keeps you awake. Meat, herbs and water make a stew that fixes nearly everything.', options: [{ label: 'Back', act: root }, bye] }) });
      opts.push(bye);
      return { text: `${name}: "Mind the drying herbs! Hello there."`, options: opts };
    }
    default: {
      const lines = [
        'Did you hear the howling last night? Closer every night.',
        'Tobin\'s prices are robbery, but what can you do.',
        'They say the old chapel glows at night. I won\'t go near it.',
        'Drink from the well, friend. The lake water tastes of mud, but it\'ll do.',
        'Stay inside after dark. The wraiths don\'t like lamplight.',
      ];
      return { text: `Villager: "${lines[Math.floor(g.minutes / 60 + g.npcs.length) % lines.length]}"`, options: [bye] };
    }
  }
}
