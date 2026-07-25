/**
 * Filters - petites fonctions pures réutilisées par les moteurs de recherche
 * (mentors, logements, opportunités). Chaque page reste responsable de son
 * état de filtre et du rendu, ce module ne fait que les prédicats.
 */
const Filters = (() => {
  function textMatch(haystack, needle) {
    if (!needle) return true;
    return (haystack || "").toString().toLowerCase().includes(needle.toLowerCase());
  }

  function selectMatch(value, filterValue) {
    if (!filterValue || filterValue === "all") return true;
    return value === filterValue;
  }

  function rangeMax(value, max) {
    if (!max) return true;
    return Number(value) <= Number(max);
  }

  function arrayIncludes(arr, value) {
    if (!value || value === "all") return true;
    return Array.isArray(arr) && arr.includes(value);
  }

  return { textMatch, selectMatch, rangeMax, arrayIncludes };
})();
