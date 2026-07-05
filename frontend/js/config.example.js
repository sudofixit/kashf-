// Template for js/config.js (which is gitignored). Copy this file to js/config.js
// and fill in the values. Never commit js/config.js.
window.KASHF_CONFIG = {
  // Mapbox PUBLIC access token — safe to expose (URL-restricted). The GitHub Pages
  // build also carries this inline in index.html.
  mapboxToken: "pk.eyJ1IjoibWFyd2FuNjciLCJhIjoiY21yN2d5bm1xMG5qZjJ5czlibzBsc3R0aCJ9.weDrfX_0q4lz3p_sgbSUfA",

  // Mistral API key — SECRET. Set this ONLY in your local js/config.js (gitignored).
  // Never put it here, never in index.html, never commit it. On GitHub Pages (no
  // config.js present) the "Ask Kashf" chat is simply disabled with a notice.
  mistralKey: ""
};
