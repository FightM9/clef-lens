#!/usr/bin/env node
/* Smoke test: runs dist/index.html in jsdom against tools/fixtures/sample.clef.
   Run `npm run build` first, or just `npm test` which does both. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "../dist/index.html"), "utf8");
const data = fs.readFileSync(path.join(__dirname, "fixtures/sample.clef"), "utf8");

const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.org/", pretendToBeVisual: true });
const { window } = dom;
const doc = window.document;
const $ = (id) => doc.getElementById(id);
const state = () => window.clefLens.state;

let fails = 0;
function ok(name, cond, extra){
  if(!cond){ fails++; console.log("FAIL  " + name + (extra ? "  -> " + extra : "")); }
  else console.log("ok    " + name + (extra ? "  (" + extra + ")" : ""));
}
function query(text){
  $("eq").value = text;
  state().eventQuery = text;
  state().eventLimit = 200;
  window.clefLens.refresh();
  return state().view.length;
}
function rows(){ return doc.querySelectorAll("#events .ev").length; }
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

async function run(){
  await wait(150);

  // ---------- naming and language ----------
  ok("title is Clef Lens", doc.title === "Clef Lens", doc.title);
  ok("no 'Report field filter' left", html.indexOf("Report field filter") === -1);
  ok("default language is English", $("langEn").classList.contains("on"));

  // ---------- theme ----------
  ok("auto theme leaves the system in charge", !doc.documentElement.hasAttribute("data-theme"));
  doc.querySelector('[data-theme-mode="dark"]').onclick();
  ok("dark pinned on the html element", doc.documentElement.getAttribute("data-theme") === "dark",
     doc.documentElement.getAttribute("data-theme"));
  ok("dark button marked active", doc.querySelector('[data-theme-mode="dark"]').classList.contains("on"));
  doc.querySelector('[data-theme-mode="light"]').onclick();
  ok("light pinned", doc.documentElement.getAttribute("data-theme") === "light");
  doc.querySelector('[data-theme-mode="auto"]').onclick();
  ok("auto clears the attribute again", !doc.documentElement.hasAttribute("data-theme"));

  doc.querySelector('[data-theme-mode="dark"]').onclick();
  await wait(80);
  ok("theme persisted", JSON.parse(window.localStorage.getItem("clefLens:db")).theme === "dark",
     window.localStorage.getItem("clefLens:db").slice(0, 60));

  // ---------- load ----------
  const file = new window.File([data], "sample.clef", { type: "text/plain" });
  $("file").onchange({ target: { files: [file] } });
  await wait(150);

  ok("app shown", $("app").classList.contains("on"));
  ok("events tab active", $("panelEvents").classList.contains("on"));
  ok("timestamp field detected", state().timeField === "@t", String(state().timeField));
  ok("2 events listed", rows() === 2, rows() + " rows");
  ok("newest first by default", state().view[0] === 1, "view=" + state().view.join(","));

  const firstMsg = doc.querySelector("#events .ev-msg").textContent;
  ok("message rendered from @mt", /lesson quality/.test(firstMsg), firstMsg);

  // ---------- query language ----------
  ok("numeric comparison", query("total < 80") === 1, "view=" + state().view.join(","));
  ok("dotted path", query("report.scores.devices.score <= 40") === 1);
  ok("array any-match", query("report.media.remote.video.maxQuality = '720p'") === 1);
  ok("and + not + Has()", query("total > 50 and not Has(reportId)") === 1);
  ok("like with underscore fallback", query("role like '%each%'") === 2);
  ok("in list", query("total in [97, 74]") === 2);
  ok("is null", query("reportId is null") === 1);
  ok("is not null", query("reportId is not null") === 1);
  ok("or + parentheses", query("(total = 97 or total = 74) and @l is null") === 2);
  ok("free text search", query("NotReadableError") === 1);
  ok("free text misses", query("zzzznothing") === 0);
  ok("empty query shows all", query("") === 2);

  query("total <");
  ok("broken query reports an error", !!state().queryError, String(state().queryError));
  ok("error visible in the bar", $("qError").textContent.length > 0);
  query("");

  // ---------- ordering ----------
  $("qOrder").onclick();
  ok("order flipped to oldest first", state().view[0] === 0, "view=" + state().view.join(","));
  $("qOrder").onclick();

  // ---------- expanding an event ----------
  const row = doc.querySelector("#events .ev-row");
  row.onclick();
  ok("detail opens", !!doc.querySelector("#events .ev-detail"));
  ok("properties flattened", doc.querySelectorAll("#events .ev-props tr").length > 10,
     doc.querySelectorAll("#events .ev-props tr").length + " props");

  const openBtn = Array.from(doc.querySelectorAll("#events .ev-actions button"))[0];
  openBtn.onclick({ stopPropagation(){} });
  ok("Open in Record switches tab", $("panelRecord").classList.contains("on"));
  ok("record shows the clicked event", $("pre").textContent.indexOf("bbbb2222") !== -1);

  // ---------- record tab ----------
  ok("pager position", $("pos").textContent.indexOf("1 / 2") === 0, $("pos").textContent);
  $("next").onclick();
  ok("forward moves on", $("pos").textContent.indexOf("2 / 2") === 0, $("pos").textContent);
  ok("back disabled at the start", (function(){ $("prev").onclick(); return $("prev").disabled; })());

  // filtered view: drop a branch on the export tab, then look again
  state().excluded = new Set(["report.systemLoad"]);
  $("recFiltered").checked = true;
  $("recFiltered").onchange({ target: { checked: true } });
  ok("filtered view hides the branch", $("pre").textContent.indexOf("systemLoad") === -1);
  $("recFiltered").checked = false;
  $("recFiltered").onchange({ target: { checked: false } });
  ok("raw view brings it back", $("pre").textContent.indexOf("systemLoad") !== -1);

  // ---------- export tab ----------
  doc.querySelector('[data-tab="export"]').onclick();
  ok("export tab active", $("panelExport").classList.contains("on"));
  ok("tree rendered", doc.querySelectorAll("#tree .row").length > 10,
     doc.querySelectorAll("#tree .row").length + " rows");
  ok("dropped counter", $("sDropped").textContent === "1", $("sDropped").textContent);
  ok("output has 2 records", state().outText.split("\n").filter(Boolean).length === 2);

  query("total < 80");
  doc.querySelector('[data-tab="export"]').onclick();
  $("optOnlyMatching").checked = true;
  $("optOnlyMatching").onchange({ target: { checked: true } });
  ok("only-matching narrows the export", state().outText.split("\n").filter(Boolean).length === 1);
  ok("stat follows the scope", $("sRecords").textContent === "1", $("sRecords").textContent);
  ok("scope label counts matches", /\(1\)/.test($("onlyMatchingLabel").textContent), $("onlyMatchingLabel").textContent);
  $("optOnlyMatching").checked = false;
  $("optOnlyMatching").onchange({ target: { checked: false } });
  query("");

  // ---------- clean-up switches still work ----------
  doc.querySelector('[data-tab="export"]').onclick();
  $("optZero").checked = true; $("optZero").onchange();
  // Record 1 has an all-zero sharing block (it goes), record 2 has real numbers (it stays).
  const firstLine = state().outText.split("\n")[0];
  ok("zero cleanup empties the all-zero block", firstLine.indexOf('"sharing"') === -1);
  ok("non-zero block survives", state().outText.indexOf('"sharing"') !== -1);
  ok("all-zero file counters gone everywhere", state().outText.indexOf('"file"') === -1);
  ok("delta label filled", $("dZero").textContent.length > 0, $("dZero").textContent);
  $("optRound").checked = true; $("optRound").onchange();
  ok("rounding applied", state().outText.indexOf("0.27786") === -1);

  const segArray = $("fmt").children[1];
  segArray.onclick();
  ok("array format is a JSON array", Array.isArray(JSON.parse(state().outText)));
  $("fmt").children[0].onclick();
  ok("ndjson is one record per line", state().outText.split("\n").filter(Boolean).length === 2);

  // ---------- presets ----------
  $("presetName").value = "Lean";
  $("savePreset").onclick();
  await wait(120);
  ok("preset listed", doc.querySelectorAll("#plist li").length === 1);
  ok("preset persisted", !!window.localStorage.getItem("clefLens:db"));

  $("resetSel").onclick();
  ok("selection cleared", $("sDropped").textContent === "0");
  $("newFile").onclick();
  $("file").onchange({ target: { files: [file] } });
  await wait(150);
  ok("preset auto-applied on reload", state().excluded.size === 1, "excluded=" + state().excluded.size);

  // ---------- Russian ----------
  $("langRu").onclick();
  ok("tabs translated", doc.querySelector('[data-tab="events"]').textContent === "События",
     doc.querySelector('[data-tab="events"]').textContent);
  ok("query placeholder kept", $("eq").getAttribute("placeholder").length > 0);
  ok("record labels translated", $("prev").textContent === "Назад", $("prev").textContent);
  ok("theme buttons translated", doc.querySelector('[data-theme-mode="dark"]').textContent === "Ночь",
     doc.querySelector('[data-theme-mode="dark"]').textContent);
  ok("theme survives the language switch", doc.documentElement.getAttribute("data-theme") === "dark");

  // ---------- field tree search ----------
  doc.querySelector('[data-tab="export"]').onclick();
  $("q").oninput({ target: { value: "calibration" } });
  const keys = Array.from(doc.querySelectorAll("#tree .key")).map(n => n.textContent);
  ok("tree search narrows", keys.includes("calibration"), keys.length + " rows");
  $("q").oninput({ target: { value: "zzzz" } });
  ok("tree search empty state", !!doc.querySelector("#tree .nomatch"));

  console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
  process.exit(fails ? 1 : 0);
}

run().catch(function(e){ console.log("CRASH", e); process.exit(1); });
