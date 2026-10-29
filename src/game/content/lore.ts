// The written layer: remnants found in the world, NPC dialogue, and the
// chapter spine. Most of the story is meant to be reconstructed rather than
// told — item descriptions in items.ts carry as much of it as these notes do.

export interface Remnant { id: string; title: string; text: string; tier: number }

/** Scraps of writing found on corpses, altars and signposts. */
export const REMNANTS: Record<string, Remnant> = {
  opening: { id: 'opening', title: 'Posted at the Gate', tier: 0, text: 'ORDINANCE OF LANTERNHOLD\n\nOne: the lamps are lit at dusk and are not permitted to go out.\nTwo: a lamp that goes out is relit by the one who let it.\nThree: there is no third ordinance. There has never needed to be.' },
  shrine: { id: 'shrine', title: 'Scratched on a Well-Stone', tier: 0, text: 'Drank here. Slept here. Woke up here, which I had stopped expecting.\n\nIf you are reading this and you also woke up: it is the lamp. Stay near the lamp. Do not get clever about the lamp.' },
  road: { id: 'road', title: 'Nailed to the Signpost', tier: 1, text: 'The cages are not a warning to you. They are a warning to the things in them, which have not entirely stopped.\n\nDo not cut them down out of kindness. Kindness is how this started.' },
  menhir: { id: 'menhir', title: 'Cut into the Standing Stone', tier: 1, text: 'Before the lamps there were the stones, and before the stones there was the dark, and the dark did not mind us.\n\nWe are the ones who could not leave it alone.' },
  catacomb: { id: 'catacomb', title: 'Left in the Mausoleum', tier: 1, text: 'My brother is in the fourth niche. I have checked him every spring for sixty years.\n\nThis spring he had turned to face the door.\n\nI am not checking again. Someone else will have to.' },
  cathedral: { id: 'cathedral', title: 'Left on the Altar', tier: 2, text: 'We sang the lamp back once, in the year of the low water. Eleven of us, three days, and on the third day the wick took.\n\nSo when the King put them all out at once, of course we sang. What else were we for?\n\nWe are still singing. The water came in at the second verse and we did not stop. I want it recorded that we did not stop.' },
  forge: { id: 'forge', title: 'Charcoal on the Forge Wall', tier: 2, text: 'He will not put the hammer down.\n\nI have brought him water, and food, and finally his own name, and he took none of them. The arm goes up. The arm comes down. Whatever is left in there is in the arm.\n\nIf you want an edge off him, put the iron on the anvil and step back. He will do the rest. He cannot not.' },

  fen1: { id: 'fen1', title: 'Rolled in an Oilcloth', tier: 0, text: 'Day forty in the fen. The hollows do not hunt. They walk where they walked when they were alive, and if you are standing in it, that is your lookout.\n\nI have seen one open a gate it had no reason to open, and go through, and shut it behind.\n\nThey are not empty. They are finished.' },
  fen2: { id: 'fen2', title: 'Pinned Under a Stone', tier: 0, text: 'The reeds whistle when the wind is from the Reach. The old men say that is the Choir.\n\nThe old men also say not to answer it. I had not been planning to. It is strange how much more carefully you do not do a thing once it has been forbidden.' },
  moor1: { id: 'moor1', title: 'In a Grave-Digger\'s Satchel', tier: 1, text: 'Rates, as agreed:\n\nA grave, dug and filled — two marks.\nA grave, dug and filled, and watched three nights — six marks.\nA grave dug twice — I will not do a grave twice. I do not care what you pay.' },
  moor2: { id: 'moor2', title: 'Folded in a Dead Hand', tier: 1, text: 'To whoever finds me: I have no coin and nothing worth the carrying. Take the boots.\n\nBut if the light in the north is still going when you pass, that is a lamp, and a lamp means a floor, and a floor means a night you survive. It cost me four days to learn that. You may have it for free.' },
  wood1: { id: 'wood1', title: 'Carved into a Pale Birch', tier: 1, text: 'ILSA + T.\n\nAnd underneath, in a different hand and much later:\n\nILSA CAME BACK. T DID NOT. ILSA IS STILL LOOKING. DO NOT TELL HER.' },
  wood2: { id: 'wood2', title: 'Under a Flat Stone', tier: 1, text: 'The Redhand are not bandits, whatever the Captain calls them in his reports. Bandits want things.\n\nThese want the road. Only the road. They have been on it so long they have gone the shape of it.' },
  low1: { id: 'low1', title: 'Wax-Sealed, Water-Ruined', tier: 2, text: '...and the water is not rising, which is what no one will say out loud. The water is the same depth it was in my grandmother\'s time.\n\nThe land is going down to meet it.' },
  low2: { id: 'low2', title: 'Tied to a Reed', tier: 2, text: 'The drowned do not drown. I have watched one stand in nine feet of fen for a season and a half.\n\nIt is waiting its turn in a queue that no longer moves.' },
  cind1: { id: 'cind1', title: 'In a Burnt Satchel', tier: 3, text: 'The Barrens were a forest. There are people alive who remember it being a forest.\n\nThat is the part that should frighten you. Not that it burned. That it burned recently, and quietly, and no one can say what lit it.' },
  cind2: { id: 'cind2', title: 'Pressed into Cooled Slag', tier: 3, text: 'Emberglass is not made. It is what is left when a fire is interrupted hard enough.\n\nWe find it in the Barrens by the cartload. Think about what that means and then go and check your lamp.' },
  bone1: { id: 'bone1', title: 'Weighted with a Skull', tier: 3, text: 'Count of the Highlands cairns, third survey: nine hundred and six.\n\nCount of the Highlands cairns, fourth survey, same ground, same season, nine years later: nine hundred and forty-one.\n\nNobody is burying them.' },
  bone2: { id: 'bone2', title: 'Frozen to a Crag', tier: 3, text: 'He said the crown was light. That was the only thing he ever said about it that I believed.\n\nEverything a king carries is heavy. A crown that weighs nothing is not a crown. It is a hole with a rim.' },
  reach1: { id: 'reach1', title: 'In a Pilgrim\'s Pocket', tier: 4, text: 'Walked to the Reach to ask the Choir to sing for my daughter.\n\nFound the Reach. Found the Choir. They were already singing. They have been singing the whole time, under the water, in the dark, for people who are dead and people who are not born.\n\nI did not ask. It would have been rude to interrupt a thing doing its work.' },
  reach2: { id: 'reach2', title: 'An Inquisitor\'s Order', tier: 4, text: 'By authority of the Reach:\n\nThe singing is to cease.\nThe water is to be drained.\nThe Warden is to be removed from the apse and burned on the plate.\n\nNone of the above has been achieved. Six companies have been sent. Record them as lost and do not send a seventh.' },

  bell1: { id: 'bell1', title: 'The Bellkeeper\'s First Letter', tier: 1, text: 'You will want to know why you keep getting up.\n\nShort answer: a lamp is burning with your name in it, and until that lamp goes out, the valley keeps handing you back.\n\nLong answer: you lit it yourself, and you do not remember doing so, and that is the kindest arrangement anyone has managed here in nine hundred years.' },
  bell2: { id: 'bell2', title: 'The Bellkeeper\'s Second Letter', tier: 3, text: 'You have been asking what the Hollow wants.\n\nIt does not want. That is the whole of it. It is what is left in a thing after the wanting stops — a man who has finished, a forge that has finished, a choir that has finished and is still going through the motions because the motions are all that is left.\n\nThe King did not bring it. He simply stopped first, and the rest of us have been catching up.' },
  bell3: { id: 'bell3', title: 'The Bellkeeper\'s Last Letter', tier: 5, text: 'When you reach him, you will have two choices, and one of them will feel like mercy.\n\nPut the crown on, and the valley stays lit, and you keep it lit, and you do not stop, ever, because the moment you stop you are him.\n\nOr put out the last lamp, and let it all go cold, and let the valley be what it was before anyone decided it needed tending.\n\nI have carried the bell for four hundred years and I still do not know which I would take. Do not ask me on the day.' },

  vael1: { id: 'vael1', title: 'A Wedding Invitation', tier: 3, text: 'The hand of VAELITH OF THE PALE HALL is promised to the Crown, at the turn of the low water, with the Choir attending.\n\nAll of the Reach is bidden. Bring nothing. The Crown has everything.' },
  vael2: { id: 'vael2', title: 'Unsent', tier: 3, text: 'He has not come. The Choir has been in the water for two days holding the note and I will not let them stop, because the moment they stop it is over and I am a woman in a wet dress in an empty hall.\n\nSo they will hold it. And I will wait. He is only late.' },
  king1: { id: 'king1', title: 'A Royal Order, Countersigned', tier: 4, text: 'Let the lamps be put out.\n\nI have asked the Reach what we are keeping back and no one can tell me. I have asked what happens if we stop and no one will say. Nine hundred years of oil and wick and watch, and not one of you can name the thing on the other side of the door.\n\nSo: out. All of them. Tonight. I will go first, and I will go alone, and if I am wrong you may say so to my face in the morning.' },
  king2: { id: 'king2', title: 'Scratched Inside the Crown', tier: 5, text: 'i was right\n\nthere was nothing there\n\nthere is still nothing there\n\nit is so much worse than something' },
};

export const REMNANT_LIST = Object.values(REMNANTS);
/** Pick a remnant appropriate to a danger tier, deterministically per position. */
export function remnantFor(tier: number, salt: number) {
  const pool = REMNANT_LIST.filter(r => r.tier <= tier && !r.id.startsWith('bell'));
  return pool[Math.abs(salt) % pool.length];
}

// ---------------------------------------------------------------- dialogue

export interface DialogNode {
  text: string;
  options?: { label: string; to?: string; act?: string; need?: string; hide?: string }[];
}
export interface NpcDef {
  id: string;
  name: string;
  title: string;
  look: string;
  /** Opens a shop with these stock ids. */
  shop?: string[];
  /** Opens the upgrade bench. */
  smith?: boolean;
  nodes: Record<string, DialogNode>;
}

export const NPCS: Record<string, NpcDef> = {
  elder: {
    id: 'elder', name: 'Maren', title: 'Elder of Lanternhold', look: 'elder',
    nodes: {
      start: {
        text: 'You are up again. Good. I have stopped counting, and I would advise you to stop as well — the number is not a comfort.\n\nThe lamps are going out, one valley-arm at a time. I need someone who does not stay dead to go and look at why.',
        options: [
          { label: 'What is out there?', to: 'world' },
          { label: 'Why do I come back?', to: 'why' },
          { label: 'Where do I start?', to: 'start_quest', act: 'chapter1' },
          { label: 'Leave.', act: 'close' },
        ],
      },
      world: {
        text: 'Fen to the south and all around us — wet, slow, survivable. Moors east, full of graves and the things that climb out of them. The Reach is north, and the Reach is where the Cathedral is, and the Cathedral is where the singing comes from.\n\nDo not go to the Reach yet. Go to the Reach eventually. There is a difference and it is worth about four hundred deaths.',
        options: [{ label: 'Back.', to: 'start' }],
      },
      why: {
        text: 'Ask the Bellkeeper. I will say only this: it is not a blessing, it is an arrangement, and arrangements can be ended by either party.\n\nYou are one of the parties. Bear that in mind before you do anything irreversible.',
        options: [{ label: 'Back.', to: 'start' }],
      },
      start_quest: {
        text: 'The nearest dark arm is the Cathedral of the Drowned Choir, north of here in the Reach. Something in the apse has been holding a note since before my grandmother.\n\nGo and make it stop. Or go and find out why it cannot. I will take either.',
        options: [{ label: 'I will go.', act: 'close' }],
      },
      done1: {
        text: 'The singing has stopped. I felt it stop. Half the valley felt it stop.\n\nThere is a hall west of the Lowlands with a woman in it who has been waiting three hundred years for a man who is not coming. Go and tell her. Gently, if you are capable of it.',
        options: [{ label: 'Understood.', act: 'close' }],
      },
      done2: {
        text: 'Vaelith is down. That leaves the one who started it.\n\nHe is in the Highlands under a crown that weighs nothing. Take whatever you have left and go, because I have nothing more to give you and no more advice worth the breath.',
        options: [{ label: 'Goodbye, Maren.', act: 'close' }],
      },
      end: {
        text: 'It is quiet. I do not know yet whether that is good.\n\nThank you. I am aware that is inadequate.',
        options: [{ label: 'Leave.', act: 'close' }],
      },
    },
  },
  bellkeeper: {
    id: 'bellkeeper', name: 'The Bellkeeper', title: 'Keeper of the First Lamp', look: 'bellkeeper',
    nodes: {
      start: {
        text: 'Ah. The one who will not stay down.\n\nI keep the bell and I keep the lamp, and between the two of them I have kept this valley half-alive for four hundred years. You are the other half.',
        options: [
          { label: 'Why do I come back?', to: 'why' },
          { label: 'What is the Hollow?', to: 'hollow' },
          { label: 'What are the lamps?', to: 'lamps' },
          { label: 'Tell me about the King.', to: 'king' },
          { label: 'Leave.', act: 'close' },
        ],
      },
      why: {
        text: 'There is a lamp with your name folded into the wick. While it burns, the valley cannot keep you.\n\nYou lit it. You do not remember lighting it. I have decided not to tell you when, because you would go and look, and looking is how people stop coming back.',
        options: [{ label: 'Back.', to: 'start' }],
      },
      hollow: {
        text: 'It is not a monster and it is not a plague. It is a condition.\n\nWhen a thing finishes — truly finishes, wants nothing further — what remains keeps moving, because moving is the last habit to go. A smith who has finished still swings. A choir that has finished still sings. A king who has finished still rules, over nothing, from a chair that is not there.\n\nThat is the Hollow. You have met it. You will meet it again. You may, in time, be it.',
        options: [{ label: 'Back.', to: 'start' }],
      },
      lamps: {
        text: 'Not holy. Not magic, whatever the Reach wrote down. A lamp is simply a thing that must be tended, and a tended thing cannot finish.\n\nThat is the whole mechanism. Nine hundred years of theology, and it comes to: somebody has to care, nightly, forever. The King found that unbearable. I find it restful. People differ.',
        options: [{ label: 'Back.', to: 'start' }],
      },
      king: {
        text: 'He was not cruel and he was not mad. He was tired, and he asked a reasonable question, and the answer was that there is nothing on the other side of the door and the tending was the point.\n\nHe could not live with the tending being the point. So he put the lamps out to prove the door was empty. It was. He was right. It did not help.',
        options: [{ label: 'Back.', to: 'start' }],
      },
      final: {
        text: 'You have his remembrance in your hands. You know what it is for.\n\nTwo doors. Wear the crown, and the valley stays lit, and you keep it lit, and you never stop. Or put out the First Lamp and let it all go cold and quiet and finished.\n\nI have carried the bell four hundred years. I still do not know. Do not ask me on the day.',
        options: [{ label: 'Leave.', act: 'close' }],
      },
    },
  },
  merchant: {
    id: 'merchant', name: 'Tobin', title: 'Trader', look: 'merchant',
    shop: ['bandage', 'bloodwort_tonic', 'throwing_knife', 'firebomb', 'whetstone', 'ash_resin', 'plank_shield', 'hunters_buckler', 'ashen_shortsword', 'hunters_spear', 'wanderer_coat', 'wanderer_boots', 'tal_lamp', 'tal_yoke'],
    nodes: {
      start: {
        text: 'Still breathing. Broadly speaking.\n\nI buy what you pull out of the dark and I sell what keeps you in it a little longer. I am not a charity and I am not a friend, but I am here at dawn, which is more than most.',
        options: [
          { label: 'Trade.', act: 'shop' },
          { label: 'Why are you still here?', to: 'why' },
          { label: 'Leave.', act: 'close' },
        ],
      },
      why: {
        text: 'Where would I go? Every road out of this valley goes further into it. I checked. Twice.\n\nSo: stock, ledger, lamp. A man can make a life out of three things if he stops looking at the fourth.',
        options: [{ label: 'Back.', to: 'start' }],
      },
    },
  },
  herbalist: {
    id: 'herbalist', name: 'Wren', title: 'Herbalist', look: 'herbalist',
    shop: ['bloodwort_tonic', 'bandage', 'ash_resin', 'tal_feather'],
    nodes: {
      start: {
        text: 'Sit, if you like. Everyone who comes through that door is bleeding and pretending not to be.\n\nI will sell you tonic. I will not ask what you did to need it.',
        options: [
          { label: 'Trade.', act: 'shop' },
          { label: 'What grows out there?', to: 'herbs' },
          { label: 'Leave.', act: 'close' },
        ],
      },
      herbs: {
        text: 'Bloodwort, in the fen, in the wet. Pallid fungus in the Rotwood, which is edible exactly once.\n\nAnd in the Barrens, nothing. Nothing at all. I went to check, because a place where nothing grows is worth a four-day walk to see, and I will not be going back.',
        options: [{ label: 'Back.', to: 'start' }],
      },
    },
  },
  warden: {
    id: 'warden', name: 'Roderic', title: 'Last of the Lanternsworn', look: 'warden',
    shop: ['lantern_sword', 'warden_kite', 'lantern_helm', 'lantern_mail', 'lantern_arms', 'lantern_legs'],
    nodes: {
      start: {
        text: 'You hold a blade like someone who has been killed with one. That is not an insult. It is most of the training.\n\nI have gear from the order. There is no order left to issue it, so I issue it. Take what you can carry.',
        options: [
          { label: 'Trade.', act: 'shop' },
          { label: 'Teach me to fight.', to: 'teach' },
          { label: 'What happened to the order?', to: 'order' },
          { label: 'Leave.', act: 'close' },
        ],
      },
      teach: {
        text: 'Four things, and then you can go.\n\nRoll through the blow, not away from it — the invulnerable part is in the middle, not the end. Watch the shoulder, not the blade. Keep a quarter of your stamina in reserve at all times; the quarter you spend is the quarter that kills you.\n\nAnd when a thing glows before it swings, that one cannot be blocked. Move.',
        options: [{ label: 'Back.', to: 'start' }],
      },
      order: {
        text: 'We were twelve hundred, and we kept four thousand lamps, and the arithmetic never worked but we made it work.\n\nThen the King gave the order and eleven hundred of us obeyed it, because that is what an order is. I did not. Neither did the ones in the Moors, and look what became of them.\n\nI am what is left of being right. It is not much to look at.',
        options: [{ label: 'Back.', to: 'start' }],
      },
    },
  },
  smith: {
    id: 'smith', name: 'Hasket', title: 'Smith of the Ember Forge', look: 'smith', smith: true,
    nodes: {
      start: {
        text: 'Put it on the anvil. I will not ask where you have been swinging it.\n\nEmberglass for the edge. Bring enough and I will take any blade you own past what it was built for.',
        options: [
          { label: 'Reinforce a weapon.', act: 'smith' },
          { label: 'What is in the back of the forge?', to: 'back' },
          { label: 'Leave.', act: 'close' },
        ],
      },
      back: {
        text: 'My predecessor.\n\nHe has been at that anvil since before the flood and he has not yet made anything. The arm goes up. The arm goes down.\n\nIf you go through that door, go in armed, and do not expect him to stop for the courtesy of it.',
        options: [{ label: 'Back.', to: 'start' }],
      },
    },
  },
  hunter: {
    id: 'hunter', name: 'Ilsa', title: 'Fenhunter', look: 'hunter',
    shop: ['hunter_tricorn', 'hunter_garb', 'hunter_gloves', 'hunter_trousers', 'bloodletter', 'throwing_knife'],
    nodes: {
      start: {
        text: 'Quiet. There is a thing in the reeds and I have been three hours getting this close to it.\n\n...It has gone. Fine. What do you want.',
        options: [
          { label: 'Trade.', act: 'shop' },
          { label: 'Who were you waiting for?', to: 'tam' },
          { label: 'Leave.', act: 'close' },
        ],
      },
      tam: {
        text: 'Nobody. I hunt.\n\n...There is a birch in the Pale Woods with two names on it. One of them walks out of the trees about once a season, at dusk, at the edge of where I can see.\n\nI have not shot at it. I am aware of what that makes me.',
        options: [{ label: 'Back.', to: 'start' }],
      },
    },
  },
};
