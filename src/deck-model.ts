export type Link = { label: string; url: string };

export type PreviewCard = {
  id: string;
  name: string;
  quantity: number;
  category: string;
  manaCost: string;
  manaValue: number;
  typeLine: string;
  image: string;
  set: string;
  collectorNumber: string;
};

export type DeckPreview = {
  provider: string;
  sourceDeckName: string;
  sourceUpdatedAt: string;
  totalCards: number;
  cards: PreviewCard[];
};

export type CustomProxyImage = {
  id: string;
  name: string;
  image: string;
  thumbnail: string;
  sourceUrl: string;
};

export type CustomGallery = {
  provider: string;
  totalImages: number;
  partial: boolean;
  path: string;
  coverImage?: string;
};

export type CustomGalleryData = Omit<CustomGallery, 'path'> & {
  images: CustomProxyImage[];
};

export type Deck = {
  id: string;
  kind: 'deck' | 'collection';
  theme: string;
  deckSource: Link;
  decklist: Link;
  creator: Link;
  notes: string;
  commanderArchetype?: string;
  aiUse?: string;
  preview?: DeckPreview;
  customGallery?: CustomGallery;
};

const accents = [
  '#c5f36c',
  '#f0b95b',
  '#68c6d4',
  '#d878ee',
  '#d05f66',
  '#7dc983',
  '#91a7ff',
  '#e8db48',
];

const colorMap: Record<string, string[]> = {
  azorius: ['W', 'U'],
  dimir: ['U', 'B'],
  rakdos: ['B', 'R'],
  gruul: ['R', 'G'],
  selesnya: ['G', 'W'],
  orzhov: ['W', 'B'],
  izzet: ['U', 'R'],
  golgari: ['B', 'G'],
  boros: ['R', 'W'],
  simic: ['G', 'U'],
  bant: ['W', 'U', 'G'],
  esper: ['W', 'U', 'B'],
  grixis: ['U', 'B', 'R'],
  jund: ['B', 'R', 'G'],
  naya: ['R', 'G', 'W'],
  abzan: ['W', 'B', 'G'],
  jeskai: ['U', 'R', 'W'],
  jeksai: ['U', 'R', 'W'],
  sultai: ['U', 'B', 'G'],
  mardu: ['B', 'R', 'W'],
  temur: ['R', 'G', 'U'],
};

export function accentFor(value: string) {
  const hash = Array.from(value).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return accents[hash % accents.length];
}

export function splitTheme(theme: string) {
  const match = theme.match(/^(.*?)\s*\(([^()]*)\)$/);
  return match
    ? { title: match[1], variant: match[2] }
    : { title: theme, variant: 'Complete custom deck' };
}

export function splitBuild(build = '') {
  const [commander, ...rest] = build.split(/\s+-\s+/);
  return {
    commander: commander || 'Deck collection',
    archetype: rest.join(' — ') || 'Community proxy archive',
  };
}

export function colorsFor(build = '') {
  const lower = build.toLowerCase();
  const mono = lower.match(/mono-?([wubrg])/i);
  if (mono) return [mono[1].toUpperCase()];
  const raw = build.match(/\(([WUBRG]{2,5})\)\s*$/i);
  if (raw) return [...new Set(raw[1].toUpperCase())];
  for (const [name, colors] of Object.entries(colorMap))
    if (lower.includes(name)) return colors;
  return [];
}

export function tagsFor(deck: Deck) {
  const tags = [deck.deckSource.label];
  if (/tokens?/i.test(deck.notes)) tags.push('Tokens');
  if (/card back/i.test(deck.notes)) tags.push('Card back');
  if (deck.preview) tags.push('Visual list');
  if (deck.customGallery) tags.push('Custom art');
  if (deck.kind === 'collection') tags.push('Collection');
  return [...new Set(tags.filter(Boolean))];
}
