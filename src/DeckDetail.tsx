import {
  ArrowLeft,
  BookOpen,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileArchive,
  Grid3X3,
  ImageOff,
  Images,
  List,
  Search,
  Share2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  accentFor,
  colorsFor,
  isProxxiedReady,
  splitBuild,
  splitTheme,
  type Deck,
  type CustomGallery,
  type CustomGalleryData,
  type CustomProxyImage,
  type PreviewCard,
} from './deck-model';

const categoryOrder = [
  'Commander',
  'Creature',
  'Planeswalker',
  'Battle',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Land',
  'Other',
];

const categoryLabels: Record<string, string> = {
  Creature: 'Creatures',
  Planeswalker: 'Planeswalkers',
  Instant: 'Instants',
  Sorcery: 'Sorceries',
  Artifact: 'Artifacts',
  Enchantment: 'Enchantments',
  Land: 'Lands',
};

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

function ManaCost({ value }: { value: string }) {
  const symbols = Array.from(
    value.matchAll(/\{([^}]+)\}/g),
    (match) => match[1],
  );
  if (!symbols.length) return null;
  return (
    <span className="mana-cost" aria-label={`Mana cost ${symbols.join(' ')}`}>
      {symbols.map((symbol, index) => (
        <span key={`${symbol}-${index}`}>{symbol}</span>
      ))}
    </span>
  );
}

function normalImage(card: PreviewCard) {
  return card.image.replace('/small/', '/normal/');
}

function smallImage(card: PreviewCard) {
  return card.image.replace('/normal/', '/small/');
}

function downloadDecklist(deck: Deck) {
  if (!deck.preview) return;
  const text = deck.preview.cards
    .map((card) => `${card.quantity} ${card.name}`)
    .join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${deck.id}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function CardInspector({ card }: { card: PreviewCard }) {
  return (
    <aside className="card-inspector" aria-live="polite">
      <div className="inspector-image-shell">
        {card.image ? (
          <img src={normalImage(card)} alt={card.name} />
        ) : (
          <div className="card-image-fallback">
            <ImageOff size={24} />
            <span>Image unavailable</span>
          </div>
        )}
        {card.quantity > 1 && (
          <span className="inspector-quantity">×{card.quantity}</span>
        )}
      </div>
      <div className="inspector-copy">
        <span>{card.category}</span>
        <h3>{card.name}</h3>
        <p>{card.typeLine}</p>
        <div>
          <ManaCost value={card.manaCost} />
          {card.set && (
            <small>
              {card.set} · {card.collectorNumber}
            </small>
          )}
        </div>
      </div>
    </aside>
  );
}

function VisualStacks({
  cards,
  active,
  onActive,
}: {
  cards: PreviewCard[];
  active: PreviewCard;
  onActive: (card: PreviewCard) => void;
}) {
  const groups = useMemo(() => {
    const values = new Map<string, PreviewCard[]>();
    for (const card of cards)
      values.set(card.category, [...(values.get(card.category) || []), card]);
    return [...values.entries()].sort(([left], [right]) => {
      const leftIndex = categoryOrder.indexOf(left);
      const rightIndex = categoryOrder.indexOf(right);
      return (
        (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
      );
    });
  }, [cards]);

  return (
    <div className="visual-stacks">
      {groups.map(([category, group]) => (
        <section className="visual-stack" key={category}>
          <header>
            <h3>{categoryLabels[category] || category}</h3>
            <span>
              {group.reduce((total, card) => total + card.quantity, 0)}
            </span>
          </header>
          <div className="stack-cards">
            {group.map((card) => (
              <button
                className={`visual-card ${active.id === card.id ? 'visual-card-active' : ''}`}
                key={card.id}
                onMouseEnter={() => onActive(card)}
                onFocus={() => onActive(card)}
                onClick={() => onActive(card)}
                title={card.name}
              >
                {card.image ? (
                  <img src={smallImage(card)} alt="" loading="lazy" />
                ) : (
                  <span className="visual-card-fallback">{card.name}</span>
                )}
                {card.quantity > 1 && (
                  <span className="visual-card-quantity">×{card.quantity}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TextList({
  cards,
  onActive,
}: {
  cards: PreviewCard[];
  onActive: (card: PreviewCard) => void;
}) {
  return (
    <div className="text-deck-list">
      {categoryOrder.map((category) => {
        const group = cards.filter((card) => card.category === category);
        if (!group.length) return null;
        return (
          <section key={category}>
            <header>
              <h3>{categoryLabels[category] || category}</h3>
              <span>
                {group.reduce((total, card) => total + card.quantity, 0)}
              </span>
            </header>
            {group.map((card) => (
              <button
                key={card.id}
                onMouseEnter={() => onActive(card)}
                onFocus={() => onActive(card)}
                onClick={() => onActive(card)}
              >
                <strong>{card.quantity}</strong>
                <span>
                  {card.name}
                  <small>{card.typeLine}</small>
                </span>
                <ManaCost value={card.manaCost} />
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function PreviewUnavailable({ deck }: { deck: Deck }) {
  return (
    <section className="preview-unavailable">
      <div className="unavailable-mark">
        <ImageOff size={28} />
      </div>
      <span className="section-number">DECK DATA / PENDING</span>
      <h2>This decklist has not been cached yet.</h2>
      <p>
        {/moxfield/i.test(deck.decklist.label)
          ? 'Moxfield currently blocks automated catalog imports. The original decklist is still available, and a future checked-in text export can activate this view without changing the page.'
          : 'This source does not currently expose a reliable structured export. The original links remain available while the community works toward a cached list.'}
      </p>
      <div className="unavailable-actions">
        {deck.decklist.url && (
          <a href={deck.decklist.url} target="_blank" rel="noreferrer">
            <BookOpen size={17} /> Open {deck.decklist.label}
            <ExternalLink size={14} />
          </a>
        )}
        {deck.deckSource.url && (
          <a href={deck.deckSource.url} target="_blank" rel="noreferrer">
            <FileArchive size={17} /> Open proxy files
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </section>
  );
}

function ProxyImage({ image }: { image: CustomProxyImage }) {
  const [failed, setFailed] = useState(false);
  return (
    <a
      className="proxy-gallery-card"
      href={image.image}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${image.name}`}
      title={image.name}
    >
      {failed ? (
        <span className="proxy-gallery-fallback">
          <ImageOff size={22} />
          Image unavailable
        </span>
      ) : (
        <img
          src={image.thumbnail}
          alt={image.name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      <span className="proxy-gallery-open">
        <ExternalLink size={13} />
      </span>
    </a>
  );
}

function ProxyGallery({
  gallery,
  sourceUrl,
}: {
  gallery: CustomGallery;
  sourceUrl: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [galleryData, setGalleryData] = useState<CustomGalleryData | null>(
    null,
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const initialCount = 12;
  const images = galleryData?.images || [];
  const visibleImages = expanded ? images : images.slice(0, initialCount);
  const remaining = images.length - visibleImages.length;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(gallery.path, { signal: controller.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error(`Gallery returned ${response.status}`);
        return response.json() as Promise<CustomGalleryData>;
      })
      .then(setGalleryData)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setLoadFailed(true);
        }
      });
    return () => controller.abort();
  }, [gallery.path]);

  return (
    <section
      className="proxy-gallery-section"
      aria-labelledby="proxy-gallery-title"
    >
      <header className="proxy-gallery-heading">
        <div>
          <span className="section-number">
            CUSTOM ART / {gallery.provider.toUpperCase()}
          </span>
          <h2 id="proxy-gallery-title">Custom proxy gallery</h2>
          <p>
            Preview the creator’s printable card designs, then open any image at
            full resolution.
          </p>
        </div>
        <div className="proxy-gallery-summary">
          <strong>{gallery.totalImages}</strong>
          <span>
            {gallery.partial ? 'public images found' : 'custom images'}
          </span>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Open source folder <ExternalLink size={13} />
          </a>
        </div>
      </header>
      {loadFailed ? (
        <div className="proxy-gallery-load-state">
          <ImageOff size={22} />
          <p>
            The image preview could not load, but the original folder is still
            available.
          </p>
        </div>
      ) : galleryData ? (
        <div className="proxy-gallery-grid">
          {visibleImages.map((image) => (
            <ProxyImage image={image} key={image.id} />
          ))}
        </div>
      ) : (
        <div
          className="proxy-gallery-grid proxy-gallery-loading"
          aria-label="Loading custom proxy images"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      )}
      {images.length > initialCount && (
        <button
          className="proxy-gallery-toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          <Images size={16} />
          {expanded ? 'Show gallery preview' : `Show ${remaining} more images`}
        </button>
      )}
    </section>
  );
}

export default function DeckDetail({
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
  const [mode, setMode] = useState<'visual' | 'text'>('visual');
  const [cardQuery, setCardQuery] = useState('');
  const [activeCard, setActiveCard] = useState<PreviewCard | null>(
    deck.preview?.cards.find((card) => card.category === 'Commander') ||
      deck.preview?.cards[0] ||
      null,
  );

  useEffect(() => {
    document.body.classList.add('deck-page-open');
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.classList.remove('deck-page-open');
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const visibleCards = useMemo(() => {
    const query = cardQuery.toLowerCase().trim();
    if (!deck.preview || !query) return deck.preview?.cards || [];
    return deck.preview.cards.filter((card) =>
      `${card.name} ${card.typeLine} ${card.category}`
        .toLowerCase()
        .includes(query),
    );
  }, [cardQuery, deck.preview]);
  const inspectedCard =
    visibleCards.find((card) => card.id === activeCard?.id) ||
    visibleCards[0] ||
    null;

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
  const shareDeck = () =>
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => onNotice('Share link copied.'));

  return (
    <div className="deck-page-backdrop">
      <dialog
        open
        className="deck-page"
        aria-modal="true"
        aria-labelledby="deck-page-title"
        style={
          { '--deck-accent': accentFor(deck.theme) } as React.CSSProperties
        }
      >
        <header className="deck-page-nav">
          <button className="deck-back" onClick={onClose}>
            <ArrowLeft size={17} /> Archive
          </button>
          <a
            className="brand"
            href="./"
            onClick={(event) => {
              event.preventDefault();
              onClose();
            }}
          >
            <span className="brand-mark">
              <Grid3X3 size={17} />
            </span>
            <span>PROXY VAULT</span>
          </a>
          <button className="deck-share" onClick={shareDeck}>
            <Share2 size={16} /> Share
          </button>
        </header>

        <section className="deck-page-hero">
          <div className="deck-hero-copy">
            <div className="eyebrow">
              <span>
                {deck.preview ? 'Visual decklist available' : 'Catalog record'}
              </span>
              <span>PV–{deck.id.slice(-6).toUpperCase()}</span>
            </div>
            <p className="card-kicker">{variant}</p>
            <h1 id="deck-page-title">{title}</h1>
            <div className="deck-hero-build">
              <ManaPips colors={colorsFor(deck.commanderArchetype)} />
              <div>
                <strong>{commander}</strong>
                <span>{archetype}</span>
              </div>
            </div>
            <div className="deck-hero-meta">
              <span>
                Curated by <strong>{deck.creator.label || 'community'}</strong>
              </span>
              {deck.preview && (
                <span>
                  <strong>{deck.preview.totalCards}</strong> cards
                </span>
              )}
              {deck.preview && (
                <span>
                  Imported from <strong>{deck.preview.provider}</strong>
                </span>
              )}
            </div>
          </div>
          <div className="deck-hero-actions">
            {deck.deckSource.url && (
              <a
                className="hero-primary-action"
                href={deck.deckSource.url}
                target="_blank"
                rel="noreferrer"
              >
                <FileArchive size={17} /> Proxy files <ExternalLink size={14} />
              </a>
            )}
            {deck.decklist.url && (
              <a href={deck.decklist.url} target="_blank" rel="noreferrer">
                <BookOpen size={17} /> Source list <ExternalLink size={14} />
              </a>
            )}
            {deck.preview && (
              <button onClick={() => downloadDecklist(deck)}>
                <Download size={17} /> Download list
              </button>
            )}
            {proxxiedReady && (
              <button onClick={openProxxied}>
                <Clipboard size={17} /> Open in Proxxied
              </button>
            )}
          </div>
        </section>

        {deck.customGallery && (
          <ProxyGallery
            gallery={deck.customGallery}
            sourceUrl={deck.deckSource.url}
          />
        )}

        {deck.preview ? (
          <section className="deck-workspace">
            <div className="deck-workspace-toolbar">
              <div className="view-switcher" aria-label="Decklist view">
                <button
                  className={mode === 'visual' ? 'active' : ''}
                  onClick={() => setMode('visual')}
                >
                  <Grid3X3 size={15} /> Visual stacks
                </button>
                <button
                  className={mode === 'text' ? 'active' : ''}
                  onClick={() => setMode('text')}
                >
                  <List size={15} /> Text list
                </button>
              </div>
              <label className="deck-card-search">
                <Search size={16} />
                <span className="sr-only">Search within deck</span>
                <input
                  value={cardQuery}
                  onChange={(event) => setCardQuery(event.target.value)}
                  placeholder="Find a card in this deck…"
                />
                {cardQuery && (
                  <button
                    aria-label="Clear card search"
                    onClick={() => setCardQuery('')}
                  >
                    ×
                  </button>
                )}
              </label>
              <span className="deck-result-count">
                {visibleCards.reduce((total, card) => total + card.quantity, 0)}{' '}
                cards shown
              </span>
            </div>
            {visibleCards.length && inspectedCard ? (
              <div className="deck-workspace-layout">
                <CardInspector card={inspectedCard} />
                {mode === 'visual' ? (
                  <VisualStacks
                    cards={visibleCards}
                    active={inspectedCard}
                    onActive={setActiveCard}
                  />
                ) : (
                  <TextList cards={visibleCards} onActive={setActiveCard} />
                )}
              </div>
            ) : (
              <div className="deck-search-empty">
                <Search size={24} />
                <h3>No matching cards</h3>
                <button onClick={() => setCardQuery('')}>Clear search</button>
              </div>
            )}
          </section>
        ) : (
          <PreviewUnavailable deck={deck} />
        )}

        <footer className="deck-page-footer">
          <div>
            <span>Notes & inclusions</span>
            <p>{deck.notes || 'No additional notes were provided.'}</p>
          </div>
          <div>
            <span>Source credit</span>
            {deck.creator.url ? (
              <a href={deck.creator.url} target="_blank" rel="noreferrer">
                {deck.creator.label || 'Original post'}{' '}
                <ExternalLink size={13} />
              </a>
            ) : (
              <p>{deck.creator.label || 'Community submission'}</p>
            )}
          </div>
          {deck.aiUse && (
            <div>
              <span>AI disclosure</span>
              <p>{deck.aiUse}</p>
            </div>
          )}
          <p className="deck-data-note">
            <Check size={13} /> Card names and printing images are cached from
            the linked decklist; custom proxy art remains with its creator.
          </p>
        </footer>
      </dialog>
    </div>
  );
}
