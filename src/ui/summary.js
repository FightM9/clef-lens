/* Counters on the export tab. */
import { byId } from "../util/dom.js";
import { formatBytes, byteLength } from "../core/format.js";
import { state } from "../state.js";
import { exportRecords } from "./options.js";

export function renderStats(){
  byId("sRecords").textContent = exportRecords().length;
  byId("sDropped").textContent = state.excluded.size;
  byId("sBefore").textContent = formatBytes(state.beforeBytes);
  byId("sAfter").textContent = formatBytes(byteLength(state.outText));
}
