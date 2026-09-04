import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Code2,
  Download,
  ExternalLink,
  Grid3X3,
  Layers3,
  List,
  Search,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import DeckDetail from './DeckDetail';
import ScrollToTop from './ScrollToTop';
import catalog from './data/decks.json';
import {
  accentFor,
  colorsFor,
  splitBuild,
  splitTheme,
  tagsFor,
  type Deck,
} from './deck-model';

const decks = [...catalog.decks, ...catalog.collections] as Deck[];
const newlyAdded = catalog.newlyAdded
  .map((id) => decks.find((deck) => deck.id === id))
  .filter((deck): deck is Deck => Boolean(deck));

function deckFromLocation() {
  const id = new URLSearchParams(window.location.search).get('deck');
  return decks.find((deck) => deck.id === id) || null;
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

function NewArrivalCard({
  deck,
  onOpen,
}: {
  deck: Deck;
  onOpen: (deck: Deck) => void;
}) {
  const { title, variant } = splitTheme(deck.theme);
  const cover =
    deck.customGallery?.coverImage ||
    deck.preview?.cards.find((card) => card.category === 'Commander')?.image ||
    deck.preview?.cards[0]?.image;
  return (
    <article
      className="new-arrival-card"
      style={{ '--deck-accent': accentFor(deck.theme) } as React.CSSProperties}
    >
      <button onClick={() => onOpen(deck)} aria-label={`View ${deck.theme}`}>
        <span className="new-arrival-art">
          {cover ? (
            <img src={cover} alt="" loading="lazy" />
          ) : (
            <span className="new-arrival-fallback" aria-hidden="true">
              {title.slice(0, 1)}
            </span>
          )}
          <span className="new-arrival-badge">New</span>
        </span>
        <span className="new-arrival-copy">
          <small>{variant}</small>
          <strong>{title}</strong>
          <span>by {deck.creator.label || 'community'}</span>
          <i>
            Explore entry <ArrowUpRight size={14} />
          </i>
        </span>
      </button>
    </article>
  );
}

function DeckListRow({
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
  const tags = tagsFor(deck).slice(0, 3);
  return (
    <article
      className="deck-list-row"
      style={{ '--deck-accent': accentFor(deck.theme) } as React.CSSProperties}
    >
      <button onClick={() => onOpen(deck)} aria-label={`View ${deck.theme}`}>
        <span className="list-row-index">
          <i>{title.slice(0, 1)}</i>
          <small>PV–{String(index + 1).padStart(3, '0')}</small>
        </span>
        <span className="list-row-title">
          <small>{variant}</small>
          <strong>{title}</strong>
          {tags.length > 0 && (
            <span className="list-row-tags">
              {tags.map((tag) => (
                <i key={tag}>{tag}</i>
              ))}
            </span>
          )}
        </span>
        <span className="list-row-build">
          <ManaPips colors={colorsFor(deck.commanderArchetype)} />
          <span>
            <strong>{commander}</strong>
            <small>{archetype}</small>
          </span>
        </span>
        <span className="list-row-creator">
          <small>Curated by</small>
          <strong>{deck.creator.label || 'community'}</strong>
        </span>
        <span className="list-row-view">
          View <ArrowUpRight size={15} />
        </span>
      </button>
    </article>
  );
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

export default function App() {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'all' | 'deck' | 'collection'>('all');
  const [color, setColor] = useState('');
  const [tokensOnly, setTokensOnly] = useState(false);
  const [sort, setSort] = useState('theme');
  const [catalogLayout, setCatalogLayout] = useState<'cards' | 'list'>('cards');
  const [selected, setSelected] = useState<Deck | null>(deckFromLocation);
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
    const syncDeckFromUrl = () => setSelected(deckFromLocation());
    window.addEventListener('popstate', syncDeckFromUrl);
    return () => window.removeEventListener('popstate', syncDeckFromUrl);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openDeck = (deck: Deck) => {
    const url = new URL(window.location.href);
    url.searchParams.set('deck', deck.id);
    window.history.pushState({}, '', url);
    setSelected(deck);
  };

  const closeDeck = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('deck');
    window.history.pushState({}, '', url);
    setSelected(null);
  };

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

      {newlyAdded.length > 0 && (
        <section className="new-arrivals" aria-labelledby="new-arrivals-title">
          <header className="new-arrivals-heading">
            <div>
              <span className="section-number">01 / NEWLY ADDED</span>
              <h2 id="new-arrivals-title">Fresh arrivals in the vault.</h2>
              <p>
                The latest community decks and collections discovered by the
                catalog sync.
              </p>
            </div>
            <a href="#browse">
              View the full archive <ArrowUpRight size={14} />
            </a>
          </header>
          <div className="new-arrivals-grid">
            {newlyAdded.map((deck) => (
              <NewArrivalCard key={deck.id} deck={deck} onOpen={openDeck} />
            ))}
          </div>
        </section>
      )}

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
            <span className="section-number">02</span>
            <h2>{query ? `Results for “${query}”` : 'The complete archive'}</h2>
          </div>
          <div className="archive-controls">
            <span>{filtered.length} found</span>
            <div className="catalog-layout-switcher" aria-label="Catalog view">
              <button
                className={catalogLayout === 'cards' ? 'active' : ''}
                onClick={() => setCatalogLayout('cards')}
                aria-label="Card view"
                title="Card view"
              >
                <Grid3X3 size={14} />
              </button>
              <button
                className={catalogLayout === 'list' ? 'active' : ''}
                onClick={() => setCatalogLayout('list')}
                aria-label="List view"
                title="List view"
              >
                <List size={14} />
              </button>
            </div>
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
          catalogLayout === 'cards' ? (
            <div className="deck-grid">
              {filtered.map((deck, index) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  index={index}
                  onOpen={openDeck}
                />
              ))}
            </div>
          ) : (
            <div className="deck-list">
              {filtered.map((deck, index) => (
                <DeckListRow
                  key={deck.id}
                  deck={deck}
                  index={index}
                  onOpen={openDeck}
                />
              ))}
            </div>
          )
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
          <span className="section-number">03 / ABOUT</span>
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
          <span className="section-number">04 / CONTRIBUTE</span>
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
        <DeckDetail deck={selected} onClose={closeDeck} onNotice={setNotice} />
      )}
      {notice && (
        <output className="toast">
          <Check size={16} /> {notice}
        </output>
      )}
      {!selected && <ScrollToTop />}
    </main>
  );
}
