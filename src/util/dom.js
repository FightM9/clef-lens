/* Thin DOM helpers. Nothing clever on purpose. */
export function byId(id){ return document.getElementById(id); }

export function el(tag, className, text){
  const node = document.createElement(tag);
  if(className) node.className = className;
  if(text != null) node.textContent = text;
  return node;
}

export function clear(node){ node.innerHTML = ""; }
