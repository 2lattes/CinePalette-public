/**
 * Échappement HTML pour les données insérées dans un gabarit innerHTML.
 * Les titres de films viennent de fichiers générés à partir de CSV : on ne
 * suppose pas qu'ils sont sans balises. Fonction pure, sans DOM.
 */
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ENTITIES[ch]);
}
