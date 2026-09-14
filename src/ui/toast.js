/* One-line transient message at the bottom of the screen. */
import { byId } from "../util/dom.js";

let timer = null;

export function showToast(message){
  const node = byId("toast");
  if(!node) return;
  node.textContent = message;
  node.classList.add("on");
  clearTimeout(timer);
  timer = setTimeout(function(){ node.classList.remove("on"); }, 2400);
}
