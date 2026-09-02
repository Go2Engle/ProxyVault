import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  ExternalLink,
  FileArchive,
  Code2,
  Layers3,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import catalog from './data/decks.json';

type Link = { label: string; url: string };
type Deck = {
  id: string;
  kind: 'deck' | 'collection';
  theme: string;
  deckSource: Link;
  decklist: Link;
  creator: Link;
  notes: string;
  commanderArchetype?: string;
  aiUse?: string;
};

const decks = [...catalog.decks, ...catalog.collections] as Deck[];
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

function accentFor(value: string) {
  const hash = Array.from(value).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return accents[hash % accents.length];
}

function splitTheme(theme: string) {
  const match = theme.match(/^(.*?)\s*\(([^()]*)\)$/);
  return match
    ? { title: match[1], variant: match[2] }
    : { title: theme, variant: 'Complete custom deck' };
}

function splitBuild(build = '') {
  const [commander, ...rest] = build.split(/\s+-\s+/);
  return {
    commander: commander || 'Deck collection',
    archetype: rest.join(' — ') || 'Community proxy archive',
  };
}

function colorsFor(build = '') {
  const lower = build.toLowerCase();
  const mono = lower.match(/mono-?([wubrg])/i);
  if (mono) return [mono[1].toUpperCase()];
  const raw = build.match(/\(([WUBRG]{2,5})\)\s*$/i);
  if (raw) return [...new Set(raw[1].toUpperCase())];
  for (const [name, colors] of Object.entries(colorMap))
    if (lower.includes(name)) return colors;
  return [];
}

function tagsFor(deck: Deck) {
  const tags = [deck.deckSource.label];
  if (/tokens?/i.test(deck.notes)) tags.push('Tokens');
  if (/card back/i.test(deck.notes)) tags.push('Card back');
  if (deck.kind === 'collection') tags.push('Collection');
  return [...new Set(tags.filter(Boolean))];
}

function isProxxiedReady(url: string) {
  return /https?:\/\/(?:www\.)?(moxfield\.com|archidekt\.com)\//i.test(url);
}

function ManaPips({ colors }: { colors: string[] }) {
  if (!colors.length) return <span className="colorless-pip">C</span>;
  return (
    <span className="mana-pips" aria-label={`Colors: ${colors.join(', ')}`}>
      {colors.map((color) => (
        <span className={`mana mana-${color.toLowerCase()}`} key={color}>
          {color}
        </span>
      ))}
    </span>
  );
}

function DeckCard({
  deck,
  index,
  onOpen,
}: {
  deck: Deck;
  index: number;
  onOpen: (deck: Deck) => void;
}) {
  const { title, variant } = splitTheme(deck.theme);
  const { commander, archetype } = splitBuild(deck.commanderArchetype);
  const accent = accentFor(deck.theme);
  return (
    <article
      className="deck-card"
      style={{ '--deck-accent': accent } as React.CSSProperties}
    >
      <button
        className="card-open-target"
        onClick={() => onOpen(deck)}
        aria-label={`View ${deck.theme}`}
      />
      <div className="card-topline">
        <span>PV–{String(index + 1).padStart(3, '0')}</span>
        <ManaPips colors={colorsFor(deck.commanderArchetype)} />
      </div>
      <div className="card-sigil" aria-hidden="true">
        <span>{title.slice(0, 1)}</span>
      </div>
      <div className="card-content">
        <p className="card-kicker">{variant}</p>
        <h3>{title}</h3>
        <p className="deck-build">
          <strong>{commander}</strong> · {archetype}
        </p>
        <div className="tag-row">
          {tagsFor(deck)
            .slice(0, 3)
            .map((item) => (
              <span key={item}>{item}</span>
            ))}
        </div>
      </div>
      <footer className="card-footer">
        <span>by {deck.creator.label || 'community'}</span>
        <button className="view-button" onClick={() => onOpen(deck)}>
          View <ArrowUpRight size={14} />
        </button>
      </footer>
    </article>
  );
}

function downloadJson(deck: Deck) {
  const blob = new Blob([JSON.stringify(deck, null, 2)], {
    type: 'application/json',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${deck.id}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadCatalog(items: Deck[]) {
  const header = [
    'Theme',
    'Deck files',
    'Decklist',
    'Creator',
    'Commander / Archetype',
    'Notes',
  ];
  const rows = items.map((deck) => [
    deck.theme,
    deck.deckSource.url,
    deck.decklist.url,
    deck.creator.label,
    deck.commanderArchetype || '',
    deck.notes,
  ]);
  const blob = new Blob(
    [[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')],
    { type: 'text/csv;charset=utf-8' },
  );
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'proxy-vault-catalog.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function DeckDetail({
  deck,
  onClose,
  onNotice,
}: {
  deck: Deck;
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const { title, variant } = splitTheme(deck.theme);
  const { commander, archetype } = splitBuild(deck.commanderArchetype);
  const proxxiedReady = isProxxiedReady(deck.decklist.url);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const openProxxied = () => {
    window.open(
      'https://proxxied.com/deckbuilder',
      '_blank',
      'noopener,noreferrer',
    );
    void navigator.clipboard
      .writeText(deck.decklist.url)
      .then(() => onNotice('Decklist URL copied — paste it into Proxxied.'));
  };

  return (
    <div
      className="detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        open
        className="detail-panel"
        aria-modal="true"
        aria-labelledby="detail-title"
        style={
          { '--deck-accent': accentFor(deck.theme) } as React.CSSProperties
        }
      >
        <div className="detail-topbar">
          <button onClick={onClose}>
            <ArrowLeft size={16} /> Back to archive
          </button>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="detail-visual">
          <span>{title.slice(0, 1)}</span>
          <div className="detail-index">
            {deck.kind === 'collection' ? 'COLLECTION' : 'COMPLETE DECK'}
            <br />
            {deck.id.slice(-10).toUpperCase()}
          </div>
        </div>
        <div className="detail-content">
          <p className="card-kicker">{variant}</p>
          <h2 id="detail-title">{title}</h2>
          <div className="detail-build">
            <ManaPips colors={colorsFor(deck.commanderArchetype)} />
            <div>
              <span>Commander / build</span>
              <strong>{commander}</strong>
              <p>{archetype}</p>
            </div>
          </div>
          {deck.notes && (
            <div className="detail-note">
              <span>Notes & inclusions</span>
              <p>{deck.notes}</p>
            </div>
          )}
          {deck.aiUse && (
            <div className="detail-note">
              <span>AI disclosure</span>
              <p>{deck.aiUse}</p>
            </div>
          )}
          <div className="detail-actions">
            {deck.deckSource.url && (
              <a
                className="primary-action"
                href={deck.deckSource.url}
                target="_blank"
                rel="noreferrer"
              >
                <FileArchive size={18} />
                <span>
                  <small>Proxy files</small>Open {deck.deckSource.label}
                </span>
                <ExternalLink size={15} />
              </a>
            )}
            {deck.decklist.url && (
              <a href={deck.decklist.url} target="_blank" rel="noreferrer">
                <BookOpen size={18} />
                <span>
                  <small>Decklist</small>Open {deck.decklist.label}
                </span>
                <ExternalLink size={15} />
              </a>
            )}
            {proxxiedReady && (
              <button onClick={openProxxied}>
                <Clipboard size={18} />
                <span>
                  <small>Print prep</small>Copy & open Proxxied
                </span>
                <ArrowUpRight size={15} />
              </button>
            )}
            <button onClick={() => downloadJson(deck)}>
              <Download size={18} />
              <span>
                <small>Portable record</small>Download JSON
              </span>
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="creator-credit">
            <span>Curated from</span>
            {deck.creator.url ? (
              <a href={deck.creator.url} target="_blank" rel="noreferrer">
                {deck.creator.label || 'source post'} <ExternalLink size={13} />
              </a>
            ) : (
              <strong>{deck.creator.label || 'the community'}</strong>
            )}
          </div>
          {!proxxiedReady && deck.decklist.url && (
            <p className="compatibility-note">
              This decklist source is not one of Proxxied’s documented
              direct-URL imports. Open the decklist and export plain text before
              importing it there.
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'all' | 'deck' | 'collection'>('all');
  const [color, setColor] = useState('');
  const [tokensOnly, setTokensOnly] = useState(false);
  const [sort, setSort] = useState('theme');
  const [selected, setSelected] = useState<Deck | null>(null);
  const [notice, setNotice] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const repositoryUrl = import.meta.env.VITE_REPOSITORY_URL || '';

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return decks
      .filter((deck) => {
        const haystack = [
          deck.theme,
          deck.commanderArchetype,
          deck.creator.label,
          deck.notes,
          deck.deckSource.label,
          deck.decklist.label,
        ]
          .join(' ')
          .toLowerCase();
        return (
          (view === 'all' || deck.kind === view) &&
          (!color || colorsFor(deck.commanderArchetype).includes(color)) &&
          (!tokensOnly || /tokens?/i.test(deck.notes)) &&
          words.every((word) => haystack.includes(word))
        );
      })
      .sort((a, b) => {
        if (sort === 'creator')
          return a.creator.label.localeCompare(b.creator.label);
        if (sort === 'commander')
          return (a.commanderArchetype || '').localeCompare(
            b.commanderArchetype || '',
          );
        return a.theme.localeCompare(b.theme);
      });
  }, [color, query, sort, tokensOnly, view]);

  return (
    <main>
      <header className="site-header" id="top">
        <a className="brand" href="#top" aria-label="Proxy Vault home">
          <span className="brand-mark">
            <Layers3 size={18} />
          </span>
          <span>PROXY VAULT</span>
          <span className="beta">COMMUNITY</span>
        </a>
        <nav aria-label="Primary navigation">
          <a className="nav-active" href="#browse">
            Browse
          </a>
          <a href="#about">About</a>
          <a className="contribute-link" href="#contribute">
            <Code2 size={16} /> Contribute
          </a>
        </nav>
      </header>

      <section className="intro">
        <div>
          <div className="eyebrow">
            <Sparkles size={14} /> A living archive of fan-made decks
          </div>
          <h1>
            Find your next
            <br />
            <em>impossible</em> deck.
          </h1>
        </div>
        <div className="intro-copy">
          <p>
            Community-built MTG proxy decks, gathered in one place. Browse by
            theme, inspect the build, then take it wherever you print.
          </p>
          <div className="stats" aria-label="Catalog statistics">
            <span>
              <strong>{catalog.decks.length}</strong> complete decks
            </span>
            <span>
              <strong>{catalog.collections.length}</strong> collections
            </span>
            <span>
              <strong>Daily</strong> sheet sync
            </span>
          </div>
        </div>
      </section>

      <section className="catalog" id="browse">
        <div className="catalog-toolbar">
          <label className="search-box">
            <Search size={19} />
            <span className="sr-only">Search decks</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search themes, commanders, creators…"
            />
            <kbd>/</kbd>
          </label>
          <div className="filters" aria-label="Deck filters">
            <button
              className={view === 'all' ? 'filter-active' : ''}
              onClick={() => setView('all')}
            >
              All <span>{decks.length}</span>
            </button>
            <button
              className={view === 'deck' ? 'filter-active' : ''}
              onClick={() => setView('deck')}
            >
              Decks
            </button>
            <button
              className={view === 'collection' ? 'filter-active' : ''}
              onClick={() => setView('collection')}
            >
              Collections
            </button>
            <label className="select-filter">
              Color <ChevronDown size={13} />
              <select
                aria-label="Filter by color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              >
                <option value="">Any color</option>
                {['W', 'U', 'B', 'R', 'G'].map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={tokensOnly ? 'filter-active' : ''}
              onClick={() => setTokensOnly((value) => !value)}
            >
              {tokensOnly && <Check size={13} />} Tokens
            </button>
          </div>
        </div>
        <div className="section-heading" id="all">
          <div>
            <span className="section-number">01</span>
            <h2>{query ? `Results for “${query}”` : 'The complete archive'}</h2>
          </div>
          <div className="archive-controls">
            <span>{filtered.length} found</span>
            <label>
              Sort{' '}
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="theme">Theme A–Z</option>
                <option value="commander">Commander</option>
                <option value="creator">Creator</option>
              </select>
            </label>
            <button onClick={() => downloadCatalog(filtered)}>
              <Download size={14} /> CSV
            </button>
          </div>
        </div>
        {filtered.length ? (
          <div className="deck-grid">
            {filtered.map((deck, index) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                index={index}
                onOpen={setSelected}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Search size={26} />
            <h3>No decks found</h3>
            <p>
              Try a broader theme, another color, or clear the token filter.
            </p>
            <button
              onClick={() => {
                setQuery('');
                setColor('');
                setTokensOnly(false);
                setView('all');
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      <section className="about-section" id="about">
        <img src="./og.png" alt="Proxy Vault collector catalog artwork" />
        <div>
          <span className="section-number">02 / ABOUT</span>
          <h2>A front door for a spreadsheet worth preserving.</h2>
          <p>
            The original community sheet remains the source of truth. Proxy
            Vault turns each row into a searchable, shareable record while
            preserving direct credit and every original link.
          </p>
          <ul>
            <li>
              <Check size={15} /> No accounts or app analytics
            </li>
            <li>
              <Check size={15} /> Static, free GitHub Pages hosting
            </li>
            <li>
              <Check size={15} /> Daily automated workbook sync
            </li>
          </ul>
          <a href={catalog.source} target="_blank" rel="noreferrer">
            View the canonical spreadsheet <ExternalLink size={15} />
          </a>
        </div>
      </section>

      <section className="contribute-section" id="contribute">
        <div>
          <span className="section-number">03 / CONTRIBUTE</span>
          <h2>Keep the vault useful.</h2>
        </div>
        <div>
          <p>
            Additions and corrections belong in the shared source whenever
            possible. Site bugs, importer improvements, and design changes
            belong in this repository.
          </p>
          <div className="contribute-actions">
            <a href={catalog.source} target="_blank" rel="noreferrer">
              <Layers3 size={17} /> Open source sheet <ExternalLink size={14} />
            </a>
            {repositoryUrl && (
              <a
                href={`${repositoryUrl}/issues/new/choose`}
                target="_blank"
                rel="noreferrer"
              >
                <Code2 size={17} /> Open an issue <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <a className="brand" href="#top">
          <span className="brand-mark">
            <Layers3 size={18} />
          </span>
          <span>PROXY VAULT</span>
        </a>
        <p>
          Made to celebrate custom decks and the people who build them. Not
          affiliated with Wizards of the Coast.
        </p>
        <a href={catalog.source} target="_blank" rel="noreferrer">
          Source data <ExternalLink size={13} />
        </a>
      </footer>
      {selected && (
        <DeckDetail
          deck={selected}
          onClose={() => setSelected(null)}
          onNotice={setNotice}
        />
      )}
      {notice && (
        <output className="toast">
          <Check size={16} /> {notice}
        </output>
      )}
    </main>
  );
}
