# 🐰 Rabbithole

**Discover music by connections, not algorithms.**

Rabbithole is a music player that lets you follow musicians through their
discographies. Click on a musician, see what else they've played on, and go
down the rabbithole.

It is an installable web app (a PWA), served at
[pickipedia.xyz/rabbithole/](https://pickipedia.xyz/rabbithole/) from the
same origin as the wiki it reads, so a Release page's "Listen in Rabbithole"
button opens it on that track and the editor can save back with your wiki
login.

## Philosophy

Most music discovery is algorithmic: "you might also like", based on
listening patterns and statistical similarity. Rabbithole takes a different
approach: **follow the humans**.

When you hear a guitarist you like, click their name. See what other
sessions they've played on. Follow them to a different song, discover a new
fiddler, follow them somewhere else. The connections are real: these
musicians actually played together.

## What it does

- **Real-time chart.** Who is playing what, when, as the song progresses:
  the soloist's card lights, the song parts strip tracks the arrangement.
- **The wiki beside the music.** A PickiPedia pane that follows the solo
  into each player's page, or stays put when you steer it yourself.
- **Trails.** From the song playing to the song you are reading about,
  through the people who played on both, queued up to listen to.
- **A timeline editor.** Chart a recording against its waveform and save
  the metadata to the wiki.
- **Webamp.** The player is a Winamp.

## How it is built

Vue 3, Pinia and Vite, built with `vite-plugin-pwa`. One rule throughout:
**a view is a function of state.** The player model mirrors Webamp's store
into a reactive state; every component renders from that and the stores,
and nothing waits for a timer (the shell test pins this).

```
src/
├── main.js                 the app: Vue, Pinia, the stylesheets
├── App.vue                 the shell: dock, pane, editor panel
├── components/             one component per piece of the dock
├── stores/
│   ├── player.js           the one player model, and what it derives
│   ├── song.js             what is loaded, the record it belongs to
│   ├── layout.js           sidebar or bar, folded or open, following or not
│   └── pane.js             which wiki page was asked for and which is shown
├── player/
│   ├── model.js            Webamp wrapped as a model: state, transport, effects
│   ├── timeline.js         the chart as pure functions
│   ├── glow.js             effect colours
│   └── ios-web-audio.js    keeps iOS off the Web Audio graph
├── wiki/
│   ├── api.js              PickiPedia, read and written
│   ├── pane-html.js        the article as HTML the pane can wear
│   ├── queue.js            what a Listen button means: now, next, or a trail
│   └── demo-songs.js       the song it opens on, and the cards' colours
├── editor/                 the timeline editor (renders itself; next to convert)
├── trail.js                trails through the performer graph
└── musician-status.js      who is in and who is out, as a rule
public/vendor/webamp.bundle.js   Webamp, vendored: see src/player/webamp-global.js
```

The timeline editor (`src/editor/`) still renders itself by hand into the
container `EditorPanel.vue` gives it; its model, `EditableTrackData`, is
already a model. Converting its rendering to components is the next piece
of work.

## Development

```bash
npm install
npm run dev       # http://127.0.0.1:5173/rabbithole/ with the wiki's API proxied
npm run build     # dist/, the thing that is deployed
npm test          # vitest: the parts, in a fake DOM
npm run test:e2e  # a playthrough in headless Chromium, with sound (needs npm run dev)
```

Open `/rabbithole/?track=<cid>` for a track from the wiki, or `/rabbithole/`
for August, the song it opens on; the dropdown lists every song with a chart
on the wiki. `?layout=bar|sidebar|auto` picks a layout for one visit;
`?enc=flac|ogg` forces an encoding; `?webaudio=off|on` forces the iOS bypass.

## Testing

`npm test` runs vitest: the chart's functions, the stores and the components,
in happy-dom, with no audio.

`npm run test:e2e` plays a song in headless Chromium, against the dev server
or any URL you give it (`npm run test:e2e -- https://pickipedia.xyz/rabbithole/`).
It presses the carrot, then checks that the audio decodes and plays (the Web
Audio analyser hears it), that Webamp's clock moves, after a seek too, and that
what the song's chart says happens when the song gets there: the pane follows
the solo, the carrot loses a bite per part, a flourish fires. It also checks
following a picker, the dropdown, the phone layout, and the editor's save
target, through Copy YAML; it never saves. Its expectations come from the
song's chart on the wiki, through `src/player/timeline.js`. It needs
Playwright's Chromium (`npx playwright install chromium`), or a path in
`RH_CHROMIUM`.

Saving needs a person signed in to PickiPedia, so the save test is theirs. On
the live site, pick a song, open ✎ edit timeline, add a marker and Save,
delete it and Save again, then run
`npm run check:save -- <your wiki name> <when you started>`. It lists every
chart page (`Release:<cid>/Metadata`) you edited since then and whether each
ended where it started. Expect one page, the song you picked, back where it
started. (On 8 Nov two saves meant for Silver 44 wrote August's page, and
nobody knew until someone read its history.)

## Deployment

`maybelle-config`'s `rabbithole-shell` role builds `dist/` and Caddy serves
it at `/rabbithole/`. Redeploy pickipedia after merging.

## Track data

A track is a Release page (`Release:<cid>`, with encodings and a parent
release) and a metadata page (`Release:<cid>/Metadata`) holding:

```yaml
ensemble:
  Justin Holmes: [guitar, vocals]
  Maddie Denton: [fiddle]
timeline:
  0: { part: intro, musicians: { band: in } }
  46.7: { part: A, solo: Harry Clark }
standardSectionLength: 13.68
```

A marker says what changes at that moment. See `src/musician-status.js` for
the in/out rule and `src/player/timeline.js` for sections.

## Related

- [PickiPedia](https://pickipedia.xyz), the traditional music knowledge base
- [CryptoGrass](https://cryptograss.live)
- [Webamp](https://webamp.org)

## License

MIT
