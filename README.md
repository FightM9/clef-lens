# Clef Lens

A browser tool for reading and trimming JSON log exports. Load an NDJSON or
JSON file, scroll the events, narrow them with a query, and export a smaller
file with the branches you do not need removed. Nothing is uploaded anywhere —
parsing, querying and saving all happen in the page.

Built for [CLEF](https://clef-json.org/) exports (one JSON object per line),
but it works with any array of similarly shaped records.

## Three tabs

**Events** — a chronological list, newest first. Each row shows the timestamp,
a level dot and the rendered message; clicking one expands every property as a
flat path list. The timestamp field is detected automatically (`@t` wins when
present) and can be changed from the dropdown next to the query box.

**Record** — one event at a time with Back and Forward, paging through whatever
the current query matched. The "As it will be exported" switch shows the record
with the export tab's removals and clean-up already applied, so you can check
the result before downloading.

**Export** — the field tree. Untick `report.systemLoad` and it leaves every
record. Inside arrays the rule applies per element: untick `media.remote.video`
and it goes from all of them. Clean-up switches remove `null`s, empty arrays,
zero counters and objects that ended up empty, and round long decimals; each
one shows how many bytes it saves on the file you have open. "Only events
matching the query" narrows the export to the current selection, in file order.

## Query language

Modelled on [Seq](https://datalust.co/seq)'s filter bar, minus the bits that
need a server.

```
total < 80                                   numbers and strings compare
verdict = 'poor'                             = is case-insensitive
report.scores.devices.score <= 40            dotted paths reach inside
report.media.remote.video.maxQuality = '720p'   arrays match if any element does
total < 80 and not Has(reportId)             and / or / not, parentheses work
email like '%gmail.com'                      % and _ wildcards
total in [97, 74]                            value lists
reportId is null                             also: is not null
NotReadableError                             no operators = plain text search
```

Functions: `Has()`, `Contains()`, `StartsWith()`, `EndsWith()`, `Lower()`,
`Length()`, `Count()`.

Two conveniences worth knowing: a leading underscore is optional, so `email`
finds CLEF's `_email`; and ISO timestamps compare correctly as strings, so
`@t >= '2026-09-14T09:00'` does what you would expect. A query that does not
parse leaves the previous result on screen and explains itself under the bar.

## Themes

Light and dark, with a three-way switch in the header: **Auto** follows the
operating system, **Light** and **Dark** pin it. The choice is stored next to
the presets, so it survives a reload.

Colours live in `styles/tokens.css` as two palettes, `--l-*` and `--d-*`. Two
small blocks map them onto the working tokens the rest of the CSS uses, so a
new colour is declared once per palette and mapped once. Nothing else in the
stylesheets refers to a literal colour. Both palettes clear WCAG AA for body
and secondary text, and AA large for hint text.

### One caveat about clean-up

"Remove zero counters" drops `0`, `false` and `""`. Whatever consumes the output
must then read a missing field as zero, and you lose the difference between
"measured, got zero" and "never measured". The other three switches are safe in
that respect.

## Use it

**On GitHub Pages.** Push the repository, then in Settings → Pages pick the
branch and the root folder. `index.html` loads ES modules from `src/`, which
Pages serves correctly.

**From disk.** ES modules need HTTP, so opening `index.html` with `file://`
will not work. Either run a local server:

```
npm run serve        # http://localhost:8080
```

or use the bundled single file, which has no such restriction:

```
npm run build        # writes dist/index.html
```

`dist/index.html` is self-contained — one file you can double-click, email or
drop on a static host on its own.

## Layout

```
index.html            markup, all UI text via data-i18n attributes
styles/
  tokens.css          colours, fonts, radii — change the look here first
  layout.css          page skeleton, tab strip, responsive rules
  components.css      buttons, panels, events list, tree rows, presets, toast
src/
  main.js             wiring: owns the redraw cycle and the load flow
  state.js            shared state object and a small event bus
  core/
    parse.js          text -> records (NDJSON, JSON array, single object)
    query.js          the query language: tokeniser, parser, evaluator
    events.js         timestamps, levels, message rendering, ordering
    schema.js         records -> field tree
    filter.js         branch removal and clean-up rules
    format.js         serialisation and byte formatting
  store/
    storage.js        storage backend detection (artifact / localStorage / memory)
    presets.js        preset records in one storage key
  ui/
    tabs.js           tab strip
    theme.js          light / dark / auto switching
    events.js         query bar and the events list
    record.js         single-record pager
    tree.js           the field tree
    options.js        export scope, format, clean-up, download and copy
    summary.js        counters
    presets.js        preset list and the raw branch list
    dropzone.js       file picking and drag and drop
    lang.js           EN / RU switch
    toast.js          transient messages
  util/dom.js         byId, el, clear
tools/
  build.js            inlines everything into dist/index.html
  check-imports.js    verifies the import graph and the bundler's module list
  smoke-test.js       runs dist/index.html in jsdom against the fixture
  fixtures/sample.clef
```

The data flow is one-way: UI modules mutate `state` and emit `"refresh"`;
`main.js` is the only place that recomputes and repaints. UI modules never
import each other's render functions, so a panel can be rewritten on its own.

## Working on it

```
npm run build     # bundle to dist/
npm test          # build, then run the smoke test in jsdom (64 assertions)
npm run check     # import graph and bundler module list
```

The bundler concatenates modules and strips `import` / `export`, so **every
top-level name in `src/` must be unique**. When you add a module, add it to
`MODULES` in `tools/build.js`; `check-imports.js` fails if you forget.

### Adding a language

1. Copy `src/i18n/en.js` to `src/i18n/xx.js` and translate the values.
2. Register it in `src/i18n/index.js` under `LOCALES`.
3. Add a button to the `.lang` group in `index.html` with `data-lang="xx"`,
   and its id to the arrays in `src/ui/lang.js`.

Strings live in the markup as `data-i18n` (text), `data-i18n-ph` (placeholder),
`data-i18n-title` and `data-i18n-aria`. Anything built in JavaScript goes
through `t("key", { name: "…" })`.

### Storage

Presets, the language and the theme sit in one key, `clefLens:db`. Three backends
are tried in order: the Claude artifact storage API, `localStorage`, then an
in-memory fallback for private mode or blocked origins. In the last case the
preset panel says so, and the raw branch list is there to copy out. Presets
saved under the tool's previous name are picked up once on first load.

## Licence

MIT — see `LICENSE`, and put your own name in it before publishing.
