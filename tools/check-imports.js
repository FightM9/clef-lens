#!/usr/bin/env node
/* Walks the import graph from src/main.js and fails if a path does not resolve.
   Cheap insurance: the bundler uses its own module list, so a typo in an
   import would only surface in the browser. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ENTRY = path.join(ROOT, "src/main.js");
const seen = new Set();
let problems = 0;

function walk(file){
  if(seen.has(file)) return;
  seen.add(file);
  const src = fs.readFileSync(file, "utf8");
  const re = /from\s+["'](\.[^"']+)["']/g;
  let m;
  while((m = re.exec(src)) !== null){
    const target = path.resolve(path.dirname(file), m[1]);
    if(!fs.existsSync(target)){
      console.log("missing import: " + m[1] + "  (in " + path.relative(ROOT, file) + ")");
      problems++;
      continue;
    }
    walk(target);
  }
}

walk(ENTRY);

const listed = require("fs").readFileSync(path.join(ROOT, "tools/build.js"), "utf8");
seen.forEach(function(file){
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if(listed.indexOf('"' + rel + '"') === -1){
    console.log("not listed in tools/build.js MODULES: " + rel);
    problems++;
  }
});

console.log(seen.size + " modules reachable, " + problems + " problems");
process.exit(problems ? 1 : 0);
