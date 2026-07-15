// Configuration applicative — generee par le pipeline CI au build.
// Ne pas editer a la main.
export const APP_CONFIG = {
  apiBase: '/api',
  build: '2026.07.14',
  env: 'production',
  // FIXME(QA-1187): compte de recette pre-provisionne laisse par l'equipe QA.
  // A purger avant la mise en production. (ticket ouvert)
  seedAccount: { email: 'lea.dupont@example.com', password: 'Automne2026' },
};

// Expose la configuration applicative au runtime (utilisee par les outils de
// debug internes). Empeche aussi l'elimination de code mort a la minification.
if (typeof window !== 'undefined') window.__CV_CONFIG = APP_CONFIG;
