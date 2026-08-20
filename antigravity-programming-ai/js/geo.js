/* ==========================================================================
   MECUZI FARM MANAGEMENT SYSTEM — Shared Geospatial Helpers (GeoJSON EPSG:4326)
   UMD module: loaded by the browser (window.FarmGeo, before js/map.js) AND by
   the Express server (require('./js/geo.js')) so geometry validation and area
   computation are IDENTICAL on client and server. DOM-free by design — it
   also runs under Node.js for the verification suite (tests/plots.test.js).
   ========================================================================== */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FarmGeo = factory();
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const EARTH_RADIUS_M = 6378137; // WGS84 equatorial radius

  function isFiniteNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
  }

  function isValidPosition(pos) {
    return Array.isArray(pos) && pos.length >= 2 &&
      isFiniteNumber(pos[0]) && isFiniteNumber(pos[1]) &&
      Math.abs(pos[0]) <= 180 && Math.abs(pos[1]) <= 90; // [lng, lat]
  }

  function positionsEqual(a, b) {
    return a[0] === b[0] && a[1] === b[1];
  }

  /* --- Ring handling ------------------------------------------------------- */

  // Close a ring if the last position differs from the first (GeoJSON
  // Polygons MUST be closed rings; walk-and-track captures never are).
  function closeRing(positions) {
    if (positions.length === 0) return positions.slice();
    const ring = positions.slice();
    if (!positionsEqual(ring[0], ring[ring.length - 1])) ring.push(ring[0].slice());
    return ring;
  }

  // Count distinct vertices (a closed ring duplicates the first at the end).
  function distinctVertexCount(ring) {
    const seen = new Set();
    ring.forEach(p => seen.add(`${p[0]},${p[1]}`));
    return seen.size;
  }

  /* --- Validation ----------------------------------------------------------
     Returns { ok: true, geometry } with a normalized (closed) geometry, or
     { ok: false, error } — a translatable key, never a hardcoded string.
     ------------------------------------------------------------------------- */
  function validatePlotGeometry(geometry) {
    if (!geometry || typeof geometry !== 'object') {
      return { ok: false, error: 'errors.geo_missing' };
    }
    if (geometry.type !== 'Polygon') {
      return { ok: false, error: 'errors.geo_not_polygon' };
    }
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0 ||
        !Array.isArray(geometry.coordinates[0])) {
      return { ok: false, error: 'errors.geo_missing' };
    }
    const outer = geometry.coordinates[0];
    if (!outer.every(isValidPosition)) {
      return { ok: false, error: 'errors.geo_bad_coords' };
    }
    const ring = closeRing(outer);
    if (distinctVertexCount(ring) < 3) {
      return { ok: false, error: 'errors.geo_too_few_points' };
    }
    // NOTE: self-intersection is not rejected here — boundary cleanup is an
    // editor-side concern (turf.js on the production build); the store keeps
    // whatever simple ring the field team captured.
    return { ok: true, geometry: { type: 'Polygon', coordinates: [ring] } };
  }

  /* --- Measurement --------------------------------------------------------- */

  // Spherical surface area of a ring in square metres (Chamberlain-Duquette
  // spherical excess approximation — accurate to ~0.1% for plot-sized rings).
  function ringAreaM2(ring) {
    const closed = closeRing(ring);
    let total = 0;
    for (let i = 0; i < closed.length - 1; i++) {
      const lng1 = closed[i][0] * Math.PI / 180, lat1 = closed[i][1] * Math.PI / 180;
      const lng2 = closed[i + 1][0] * Math.PI / 180, lat2 = closed[i + 1][1] * Math.PI / 180;
      total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    return Math.abs(total * EARTH_RADIUS_M * EARTH_RADIUS_M / 2);
  }

  function areaHectares(geometry) {
    return ringAreaM2(geometry.coordinates[0]) / 10000;
  }

  function centroid(geometry) {
    const ring = closeRing(geometry.coordinates[0]);
    let lng = 0, lat = 0;
    const n = ring.length - 1; // skip duplicated closing vertex
    for (let i = 0; i < n; i++) { lng += ring[i][0]; lat += ring[i][1]; }
    return [lng / n, lat / n]; // [lng, lat] — Leaflet wants [lat, lng]
  }

  /* --- Offline capture helpers --------------------------------------------- */

  // Build a normalized GeoJSON Polygon from raw captured points (GPS fixes or
  // map clicks as [lat, lng] pairs, as produced by Leaflet/Geolocation).
  function polygonFromCapturedLatLngs(latlngs) {
    const ring = latlngs.map(ll => [ll[1], ll[0]]); // flip to GeoJSON [lng, lat]
    const result = validatePlotGeometry({ type: 'Polygon', coordinates: [ring] });
    if (!result.ok) return result;
    return {
      ok: true,
      geometry: result.geometry,
      areaHectares: Math.round(areaHectares(result.geometry) * 100) / 100
    };
  }

  return {
    isValidPosition,
    closeRing,
    distinctVertexCount,
    validatePlotGeometry,
    areaHectares,
    ringAreaM2,
    centroid,
    polygonFromCapturedLatLngs
  };
});
