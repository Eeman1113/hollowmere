// The economy. Merchants hold real stock that depletes and restocks, and each
// one pays over the odds for the kind of goods they actually want — so where
// you sell matters as much as what you sell.

import type { Goods } from './items';

export interface StockEntry {
  id: string;
  /** Starting and maximum quantity. 0 means "never stocks this". */
  qty: number;
  /** Units returned per restock cycle. 0 = one-off, never restocks. */
  restock: number;
  /** Overrides the merchant's base markup for this line. */
  markup?: number;
}

export interface ShopDef {
  id: string;
  /** Name shown above the counter. */
  title: string;
  /** Flavour line in the trade window. */
  blurb: string;
  /** Multiplier on an item's value when you buy. */
  buyRate: number;
  /** Multiplier on an item's value when you sell. */
  sellRate: number;
  /** Categories this trader pays a premium for. */
  pays: Partial<Record<Goods, number>>;
  /** Categories they refuse outright. */
  refuses?: Goods[];
  stock: StockEntry[];
  /** Real seconds of play between restocks. */
  restockEvery: number;
}

const DAY = 600; // a restock cycle, in play-seconds

export const SHOPS: Record<string, ShopDef> = {
  merchant: {
    id: 'merchant', title: 'Tobin\'s Stall', buyRate: 1.0, sellRate: 0.45,
    blurb: 'I buy what you pull out of the dark and sell what keeps you in it a little longer.',
    pays: { relic: 1.5, common: 1.25, occult: 1.1 },
    restockEvery: DAY,
    stock: [
      { id: 'bandage', qty: 12, restock: 6 },
      { id: 'bloodwort_tonic', qty: 6, restock: 3 },
      { id: 'throwing_knife', qty: 20, restock: 10 },
      { id: 'firebomb', qty: 6, restock: 3 },
      { id: 'whetstone', qty: 4, restock: 2 },
      { id: 'ash_resin', qty: 4, restock: 2 },
      { id: 'plank_shield', qty: 1, restock: 1 },
      { id: 'hunters_buckler', qty: 1, restock: 0, markup: 1.1 },
      { id: 'ashen_shortsword', qty: 1, restock: 0 },
      { id: 'hunters_spear', qty: 1, restock: 0 },
      { id: 'wanderer_coat', qty: 1, restock: 0 },
      { id: 'wanderer_boots', qty: 1, restock: 0 },
      { id: 'tal_lamp', qty: 1, restock: 0, markup: 1.3 },
      { id: 'tal_yoke', qty: 1, restock: 0, markup: 1.3 },
      { id: 'emberglass', qty: 3, restock: 2, markup: 1.6 },
    ],
  },
  herbalist: {
    id: 'herbalist', title: 'Wren\'s Table', buyRate: 0.92, sellRate: 0.5,
    blurb: 'I will sell you tonic. I will not ask what you did to need it.',
    pays: { herb: 1.7, beast: 1.15, occult: 1.2 },
    refuses: ['arms'],
    restockEvery: DAY * 0.8,
    stock: [
      { id: 'bloodwort_tonic', qty: 10, restock: 6, markup: 0.85 },
      { id: 'bandage', qty: 10, restock: 6, markup: 0.85 },
      { id: 'ash_resin', qty: 6, restock: 4 },
      { id: 'tal_feather', qty: 1, restock: 0 },
    ],
  },
  warden: {
    id: 'warden', title: 'The Order\'s Stores', buyRate: 1.05, sellRate: 0.42,
    blurb: 'There is no order left to issue it, so I issue it. Take what you can carry.',
    pays: { arms: 1.5, metal: 1.3, relic: 1.1 },
    restockEvery: DAY * 2,
    stock: [
      { id: 'lantern_sword', qty: 1, restock: 0 },
      { id: 'warden_kite', qty: 1, restock: 0 },
      { id: 'lantern_helm', qty: 1, restock: 0 },
      { id: 'lantern_mail', qty: 1, restock: 0 },
      { id: 'lantern_arms', qty: 1, restock: 0 },
      { id: 'lantern_legs', qty: 1, restock: 0 },
      { id: 'ossuary_tower', qty: 1, restock: 0, markup: 1.15 },
      { id: 'whetstone', qty: 6, restock: 4 },
    ],
  },
  hunter: {
    id: 'hunter', title: 'Ilsa\'s Camp', buyRate: 0.95, sellRate: 0.55,
    blurb: 'Quiet. ...It has gone. Fine. What do you want.',
    pays: { beast: 1.9, herb: 1.2, arms: 1.1 },
    refuses: ['relic'],
    restockEvery: DAY,
    stock: [
      { id: 'hunter_tricorn', qty: 1, restock: 0 },
      { id: 'hunter_garb', qty: 1, restock: 0 },
      { id: 'hunter_gloves', qty: 1, restock: 0 },
      { id: 'hunter_trousers', qty: 1, restock: 0 },
      { id: 'bloodletter', qty: 1, restock: 0, markup: 1.2 },
      { id: 'throwing_knife', qty: 24, restock: 12, markup: 0.8 },
    ],
  },
  smith: {
    id: 'smith', title: 'The Ember Forge', buyRate: 1.0, sellRate: 0.5,
    blurb: 'Put it on the anvil. I will not ask where you have been swinging it.',
    pays: { metal: 1.8, arms: 1.35, beast: 1.05 },
    refuses: ['herb'],
    restockEvery: DAY * 1.5,
    stock: [
      { id: 'emberglass', qty: 10, restock: 6, markup: 1.25 },
      { id: 'beastcleaver', qty: 1, restock: 0 },
      { id: 'ossuary_hammer', qty: 1, restock: 0 },
      { id: 'gravewarden_halberd', qty: 1, restock: 0, markup: 1.2 },
      { id: 'whetstone', qty: 8, restock: 5, markup: 0.9 },
    ],
  },
  bellkeeper: {
    id: 'bellkeeper', title: 'The Bellkeeper\'s Alms', buyRate: 1.15, sellRate: 0.6,
    blurb: 'I keep the bell and I keep the lamp. Occasionally I keep other things.',
    pays: { occult: 2.0, relic: 1.6 },
    refuses: ['beast', 'common'],
    restockEvery: DAY * 2,
    stock: [
      { id: 'bellkeeper_staff', qty: 1, restock: 0 },
      { id: 'choir_veil', qty: 1, restock: 0 },
      { id: 'tal_shroud', qty: 1, restock: 0 },
      { id: 'tal_coin', qty: 1, restock: 0 },
      { id: 'grave_wax', qty: 4, restock: 2 },
    ],
  },
};

/** How much a shop pays for one unit of an item. */
export function sellPrice(shop: ShopDef, value: number, goods: Goods | undefined, priceMul = 1) {
  if (goods && shop.refuses?.includes(goods)) return 0;
  const interest = (goods && shop.pays[goods]) || 1;
  return Math.max(1, Math.round(value * shop.sellRate * interest * priceMul));
}

/**
 * What a shop charges for one unit. Thin stock costs more — the last tonic on
 * the shelf is never the same price as the first.
 */
export function buyPrice(shop: ShopDef, value: number, entry: StockEntry, have: number, priceMul = 1) {
  const max = Math.max(1, entry.qty);
  const scarcity = 1 + 0.4 * (1 - Math.min(1, have / max));
  return Math.max(1, Math.round(value * shop.buyRate * (entry.markup ?? 1) * scarcity * priceMul));
}

export const shopFor = (id: string) => SHOPS[id];
