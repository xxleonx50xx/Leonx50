// ================= Set de iconos propios (SVG, currentColor) =================
// Iconos de línea consistentes para reemplazar emojis en la interfaz.
const P = {
  play:    '<path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/>',
  stop:    '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>',
  plus:    '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  map:     '<path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Zm0 0v14m6-12v14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  flag:    '<path d="M6 21V4m0 1h11l-2 4 2 4H6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  medal:   '<circle cx="12" cy="14" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 3h6l-2 5H11L9 3Z" fill="currentColor"/><path d="M12 12.2l.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 14.3l2-.2.9-1.9Z" fill="currentColor"/>',
  trophy:  '<path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 5H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3M10 13v3h4v-3M8 20h8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  gift:    '<path d="M4 11h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8Zm-1-4h18v4H3V7Zm9 0v13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 7S10 3 7.5 4 10 7 12 7Zm0 0s2-4 4.5-3S14 7 12 7Z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  bolt:    '<path d="M13 3 5 13h5l-1 8 8-11h-5l1-7Z" fill="currentColor"/>',
  gear:    '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  user:    '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 20a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  chevron: '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  share:   '<path d="M12 15V4m0 0-3.5 3.5M12 4l3.5 3.5M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  camera:  '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13" r="3.3" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  lock:    '<rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  flame:   '<path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c1.5 0 1-3-.5-4.5C13 8 12 5 12 3Z" fill="currentColor"/>',
  star:    '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" fill="currentColor"/>',
  route:   '<circle cx="6" cy="18" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="6" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.2 16.5 15 8m1 10h1a2 2 0 0 0 0-4H8a2 2 0 0 1 0-4h1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  magnet:  '<path d="M6 4h4v7a2 2 0 0 0 4 0V4h4v7a6 6 0 0 1-12 0V4Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 8h4m4 0h4" stroke="currentColor" stroke-width="1.6"/>',
  radar:   '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 12 19 8m-7 4v-8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  timer:   '<circle cx="12" cy="13" r="7.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 13V9m-2-6h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  apple:   '<path d="M16.3 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1.1 2.6-2.2.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.3-.9-2.3-3.5ZM14.4 6c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .1 2-.5 2.5-1.2Z" fill="currentColor"/>',
  check:   '<path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  spark:   '<path d="M12 3v6m0 6v6m-9-9h6m6 0h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  target:  '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  pin:     '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="2.6" fill="currentColor"/>',
  swords:  '<path d="M4 4h3l9 9m4 4-4 4-3-3M20 4h-3l-3 3m-7 7-3 3 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  sound:   '<path d="M4 9v6h4l5 4V5L8 9H4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  mute:    '<path d="M4 9v6h4l5 4V5L8 9H4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m17 9 4 6m0-6-4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  edit:    '<path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m14 6 4 4" stroke="currentColor" stroke-width="1.7"/>',
  close:   '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  gauge:   '<path d="M4 15a8 8 0 1 1 16 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 14l4-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  straight:'<path d="M9 21V3m6 18V3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 6v3m0 3v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="0.1 3.5"/>',
  curve:   '<path d="M7 21c0-6 3-8 6-9s4-4 4-9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15 3h3v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
};

export function ic(name, size = 20, cls = "") {
  const p = P[name] || "";
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${p}</svg>`;
}
