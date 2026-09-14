/* Serialisation and human-readable byte sizes. */
import { t, getLang } from "../i18n/index.js";

const encoder = new TextEncoder();

export function serializeRows(rows, format, pretty){
  const indent = pretty ? 2 : 0;
  if(format === "array") return JSON.stringify(rows, null, indent);
  const parts = [];
  for(let i = 0; i < rows.length; i++) parts.push(JSON.stringify(rows[i], null, indent));
  return parts.join("\n");
}

export function byteLength(str){ return encoder.encode(str).length; }

export function formatBytes(bytes){
  if(bytes < 1024) return bytes + " " + t("unit.b");
  const nf = new Intl.NumberFormat(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if(bytes < 1048576) return nf.format(bytes / 1024) + " " + t("unit.kb");
  const nf2 = new Intl.NumberFormat(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return nf2.format(bytes / 1048576) + " " + t("unit.mb");
}

/* Only worth showing a saving once it is more than a rounding artefact. */
export function formatSaving(bytes){
  return bytes > 40 ? "−" + formatBytes(bytes) : "";
}
