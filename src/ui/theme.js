/* Light / dark switching.

   "auto" leaves the html element without data-theme, so the media query in
   tokens.css follows the operating system. "light" and "dark" pin it. */
import { byId } from "../util/dom.js";
import { state } from "../state.js";

export const THEMES = ["auto", "light", "dark"];

export function applyTheme(mode){
  const theme = THEMES.indexOf(mode) !== -1 ? mode : "auto";
  state.theme = theme;

  if(theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);

  syncThemeButtons();
  return theme;
}

export function syncThemeButtons(){
  const group = byId("theme");
  if(!group) return;
  Array.prototype.forEach.call(group.querySelectorAll("button"), function(btn){
    const active = btn.getAttribute("data-theme-mode") === state.theme;
    btn.classList.toggle("on", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

export function mountTheme(onChange){
  const group = byId("theme");
  if(!group) return;
  Array.prototype.forEach.call(group.querySelectorAll("button"), function(btn){
    btn.onclick = function(){
      applyTheme(btn.getAttribute("data-theme-mode"));
      onChange(state.theme);
    };
  });
  syncThemeButtons();
}
