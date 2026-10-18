# 🐰 Rabbithole

**Discover music by connections, not algorithms.**

> ## Which copy is this?
>
> **This repo is the player. Everything that looks like the player somewhere
> else is a stale copy.**
>
> On 26 December 2025 the player was copied out of
> [arthel](https://github.com/cryptograss/arthel) into this repo, byte for
> byte — 2030 identical lines. Only this copy has moved since; arthel's has
> not been touched since 24 November 2025. The copy kept the retired filename
> `webamp-chartifacts.js`, because a rename in arthel does not travel through
> a copy made from a file's contents.
>
> Nothing recorded any of that, so it cost real time three separate ways:
> a reviewer reasonably read the retired name as evidence we were on the dead
> copy; two days of work went into `pickipedia-demo.html` while the deployed
> URL route serves `shell.html`; and three stylesheet rules for classes this
> player *sets* were left behind in arthel, including `has-rabbit`, the
> followed musician's card.
>
> So, as of 18 October 2026:
>
> | thing | the one that counts | stale copies |
> |---|---|---|
> | the player | `src/player/webamp-chartifacts.js` — being renamed to `rabbithole-player.js` | arthel's `src/sites/justinholmes.com/js/rabbithole_player.js` |
> | the PickiPedia shell | `pickipedia-demo.html` | `shell.html` (April 2026) — but note Caddy's `/rabbithole/*` fallback serves **shell.html**, so deep links get the stale one until that is resolved |
> | the built bundle | there isn't one; build it | `dist/` on disk, gitignored, dated February 2026, loaded by nothing |
>
> If you add a copy, add a line here. A copy without a note is a trap that
> goes off months later.

Rabbithole is a music player that lets you follow musicians through their discographies. Click on a musician, see what else they've played on, and go down the rabbithole.

## Philosophy

Most music discovery is algorithmic - "you might also like" based on listening patterns and statistical similarity. Rabbithole takes a different approach: **follow the humans**.

When you hear a guitarist you like, click their name. See what other sessions they've played on. Follow them to a different song, discover a new fiddler, follow them somewhere else. The connections are real - these musicians actually played together.

## Features

- **Real-time visualization** - See who's playing what, when, as the song progresses
- **Musician following** - Place a 🐰 on any musician and auto-queue their other recordings
- **Connection browsing** - Click any musician to see their full discography
- **PickiPedia integration** - Links to wiki pages for deep dives on musicians
- **Webamp-powered** - Nostalgic Winamp-style interface
- **Embeddable** - Drop it into any page via iframe or web component

## Quick Start

```html
<script type="module">
  import { RabbitholePlayer, PickiPediaCatalog } from '@cryptograss/rabbithole';

  const player = new RabbitholePlayer({
    containerId: 'player',
    catalog: new PickiPediaCatalog({
      baseUrl: 'https://pickipedia.xyz'
    })
  });

  await player.init();
  player.playSong('august');
</script>

<div id="player"></div>
```

## Catalog Sources

Rabbithole needs a catalog of songs with timeline/ensemble data. Two built-in options:

### PickiPediaCatalog

Fetches data from a PickiPedia (Semantic MediaWiki) instance:

```javascript
import { PickiPediaCatalog } from '@cryptograss/rabbithole/catalog';

const catalog = new PickiPediaCatalog({
  baseUrl: 'https://pickipedia.xyz'
});
```

### StaticCatalog

For testing or embedding with pre-baked data:

```javascript
import { StaticCatalog } from '@cryptograss/rabbithole/catalog';

const catalog = new StaticCatalog({
  'august': {
    title: 'August',
    audioFile: '/audio/august.mp3',
    duration: 245,
    ensemble: {
      'Justin Holmes': ['guitar'],
      'Cory Walker': ['banjo']
    },
    timeline: { /* ... */ }
  }
});
```

## Track Data Format

Each track needs:

```typescript
interface RabbitholeTrack {
  title: string;
  slug: string;
  audioFile: string;          // URL to audio
  duration: number;           // seconds
  ensemble: {                 // musician -> instruments
    [musicianName: string]: string[];
  };
  timeline: {                 // musical events by timestamp
    [timestamp: string]: TimelineEvent;
  };
  standardSectionLength?: number;
  colorScheme?: ColorScheme;
  // Optional metadata
  engineer?: string;
  studio?: string;
  recordDate?: string;
  release?: string;
}
```

## Development

```bash
npm install
npm run dev     # Start dev server
npm run build   # Build for production
npm run test    # Run tests
```

## Project Structure

```
rabbithole/
├── src/
│   ├── index.js           # Main entry point
│   ├── state.js           # RabbitholeState - following/queueing logic
│   ├── catalog.js         # CatalogAPI + implementations
│   ├── player/
│   │   ├── index.js       # WebampChartifacts player
│   │   ├── ensemble.js    # Ensemble display component
│   │   ├── timeline.js    # Timeline/parts visualization
│   │   └── webamp.js      # Webamp integration
│   └── styles/
│       └── rabbithole.css
├── index.html             # Demo/dev page
├── package.json
└── vite.config.js
```

## Related Projects

- [PickiPedia](https://pickipedia.xyz) - Traditional music knowledge base
- [CryptoGrass](https://cryptograss.live) - Bluegrass meets blockchain
- [Webamp](https://webamp.org) - Winamp reimplemented in the browser

## License

MIT
