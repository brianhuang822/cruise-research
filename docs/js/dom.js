// Safe HTML: every ${value} in html`` is escaped unless it is itself html`` output.
// mount()/append() are the only places markup enters the DOM.

const RAW = Symbol('raw');
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const trusted = (s) => ({ [RAW]: s });

function part(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(part).join('');
  if (typeof v === 'object' && RAW in v) return v[RAW];
  return escape(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return trusted(out);
}

const fragment = (markup) => document.createRange().createContextualFragment(part(markup));
export const mount = (el, markup) => el.replaceChildren(fragment(markup));
export const append = (el, markup) => el.append(fragment(markup));
export const $ = (id) => document.getElementById(id);
