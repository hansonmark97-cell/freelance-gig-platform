function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Haversine distance between two lat/lng points in miles.
 */
function haversineDistanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Shortest distance (in miles) from point P to line segment A→B.
 * Uses a Cartesian projection for the parameter t, then haversine for the
 * actual distance — a good approximation for detours of a few miles.
 */
function distanceToSegmentMiles(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLat - aLat;
  const dy = bLng - aLng;
  if (dx === 0 && dy === 0) {
    return haversineDistanceMiles(pLat, pLng, aLat, aLng);
  }
  const t = Math.max(
    0,
    Math.min(1, ((pLat - aLat) * dx + (pLng - aLng) * dy) / (dx * dx + dy * dy))
  );
  return haversineDistanceMiles(pLat, pLng, aLat + t * dx, aLng + t * dy);
}

module.exports = { generateId, haversineDistanceMiles, distanceToSegmentMiles };
