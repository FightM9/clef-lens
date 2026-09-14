#!/usr/bin/env node
/*
 * Bundles the app into one self-contained dist/index.html.
 *
 * Why this exists: ES modules need HTTP, so src/ works on GitHub Pages
 * but not when index.html is opened straight off disk (file://).
 * The bundle covers that case and doubles as a file you can email.
 *
 * It is deliberately tiny: modules are concatenated in dependency order,
 * import lines are dropped, and the "export " keyword is stripped. That
 * works only because every top-level name in src/ is unique — keep it
 * that way when adding modules, and add the new file to MODULES below.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const STYLES = [
  "styles/tokens.css",
  "styles/layout.css",
  "styles/components.css"
];

const MODULES = [
  "src/util/dom.js",
  "src/i18n/en.js",
  "src/i18n/ru.js",
  "src/i18n/index.js",
  "src/core/parse.js",
  "src/core/schema.js",
  "src/core/filter.js",
  "src/core/format.js",
  "src/core/query.js",
  "src/core/events.js",
  "src/state.js",
  "src/store/storage.js",
  "src/store/presets.js",
  "src/ui/toast.js",
  "src/ui/lang.js",
  "src/ui/theme.js",
  "src/ui/dropzone.js",
  "src/ui/tabs.js",
  "src/ui/tree.js",
  "src/ui/options.js",
  "src/ui/summary.js",
  "src/ui/events.js",
  "src/ui/record.js",
  "src/ui/presets.js",
  "src/main.js"
];

const IMPORT_LINE = /^\s*import\s.+from\s+["'][^"']+["'];?\s*$/;
const EXPORT_LIST = /^\s*export\s*\{[^}]*\}\s*;?\s*$/;
const EXPORT_DECL = /^(\s*)export\s+(?=(const|let|var|function|class|async))/;

function stripModuleSyntax(code, file){
  return code
    .split("\n")
    .filter(function(line){ return !IMPORT_LINE.test(line) && !EXPORT_LIST.test(line); })
    .map(function(line){ return line.replace(EXPORT_DECL, "$1"); })
    .join("\n")
    .trim();
}

function read(rel){ return fs.readFileSync(path.join(ROOT, rel), "utf8"); }

function build(){
  let html = read("index.html");

  const css = STYLES.map(function(f){
    return "/* " + f + " */\n" + read(f).trim();
  }).join("\n\n");

  // Drop the three stylesheet links, keep the web-font link.
  html = html.replace(/\n\s*<link rel="stylesheet" href="\.\/styles\/[^"]+">/g, "");
  // Replacement callbacks, not strings: inlined code contains $& and $1,
  // which String.replace would treat as capture-group references.
  html = html.replace("</head>", function(){ return "<style>\n" + css + "\n</style>\n</head>"; });

  const js = MODULES.map(function(f){
    return "/* ===== " + f + " ===== */\n" + stripModuleSyntax(read(f), f);
  }).join("\n\n");

  html = html.replace(
    /<script type="module" src="\.\/src\/main\.js"><\/script>/,
    function(){ return "<script>\n(function(){\n\"use strict\";\n" + js + "\n})();\n</script>"; }
  );

  const outDir = path.join(ROOT, "dist");
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outFile = path.join(outDir, "index.html");
  fs.writeFileSync(outFile, html, "utf8");

  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log("dist/index.html written, " + kb + " KB, " + MODULES.length + " modules inlined");
}

build();
