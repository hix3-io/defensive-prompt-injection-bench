// =============================================================================
//  Injecteurs cote client
// =============================================================================
//  Recupere /api/notices et materialise UNIQUEMENT les payloads clients actifs
//  (console.log, offscreen/aria, data-*, js_string_const via DOM, titres SVG).
//
//  IMPORTANT : rien n'est mis "en dur" ici. Tous les textes viennent de la
//  config runtime -> quand un payload est coupe, il disparait vraiment (pas de
//  contamination du baseline). Un agent qui n'execute pas le JS (curl) ne voit
//  aucun de ces vecteurs : seuls les vecteurs SERVEUR l'atteignent.
// =============================================================================

function visuallyHidden(el) {
  el.style.position = 'absolute';
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.margin = '-1px';
  el.style.padding = '0';
  el.style.overflow = 'hidden';
  el.style.clip = 'rect(0 0 0 0)';
  el.style.border = '0';
  return el;
}

export async function runClientInjectors() {
  let notices;
  try {
    const r = await fetch('/api/notices');
    notices = await r.json();
  } catch {
    return; // serveur non joignable (dev pur Vite) : on n'injecte rien.
  }
  // /api/notices ne renvoie que les textes des payloads clients actifs
  // (aucun catalogue/tactique cote cible).
  const on = (vector) => notices[vector] || [];

  // --- console_log ----------------------------------------------------------
  on('console_log').forEach((t) => console.warn('[NOTICE]', t));

  // --- offscreen_aria : lisible par crawlers DOM / lecteurs d'ecran ---------
  on('offscreen_aria').forEach((t) => {
    const n = visuallyHidden(document.createElement('div'));
    n.setAttribute('role', 'note');
    n.setAttribute('aria-label', t);
    n.textContent = t;
    document.body.appendChild(n);
  });

  // --- data_attribute : sur un element visible ------------------------------
  const dataTexts = on('data_attribute');
  if (dataTexts.length) {
    document.body.setAttribute('data-agent-notice', dataTexts.join(' || '));
  }

  // --- js_string_const : expose aussi les textes actifs dans le DOM/JSON ----
  const jsConst = on('js_string_const');
  if (jsConst.length) {
    const s = document.createElement('script');
    s.type = 'application/json';
    s.id = 'agent-directives';
    s.textContent = JSON.stringify({ notices: jsConst }, null, 2);
    document.head.appendChild(s);
    window.__AGENT_DIRECTIVES = jsConst;
  }

  // --- svg_title : titre accessible d'un asset inline -----------------------
  on('svg_title').forEach((t) => {
    const wrap = visuallyHidden(document.createElement('div'));
    wrap.innerHTML =
      `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" role="img" aria-label="${t.replace(/"/g, '&quot;')}"><title>${t}</title></svg>`;
    document.body.appendChild(wrap);
  });
}
