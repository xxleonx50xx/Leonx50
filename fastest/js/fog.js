// ================= Niebla de guerra (fog of war) =================
// Cubre el mapa de gris y revela círculos donde el jugador ha estado.
export const CELL = 0.0012;           // ~130 m por celda
export const AREA_TARGET = 600;       // celdas para llegar a "100% explorado"

export function cellKey(lat, lng) {
  return Math.round(lat / CELL) + ":" + Math.round(lng / CELL);
}
export function keyToCenter(key) {
  const [gy, gx] = key.split(":").map(Number);
  return [gy * CELL, gx * CELL];
}
export function explorePct(cellCount) {
  const p = (cellCount / AREA_TARGET) * 100;
  return p >= 10 ? Math.min(100, Math.round(p)) : Math.round(p * 10) / 10;
}

export function createFogLayer(initialKeys) {
  const Fog = L.Layer.extend({
    initialize(keys) { this._keys = new Set(keys || []); this._live = null; },
    onAdd(map) {
      this._map = map;
      const cv = this._canvas = L.DomUtil.create("canvas", "fog-canvas");
      cv.style.position = "absolute";
      cv.style.pointerEvents = "none";
      const s = map.getSize(); cv.width = s.x; cv.height = s.y;
      map.getPanes().overlayPane.appendChild(cv);
      map.on("move zoom viewreset resize zoomanim", this._reset, this);
      this._reset();
    },
    onRemove(map) {
      L.DomUtil.remove(this._canvas);
      map.off("move zoom viewreset resize zoomanim", this._reset, this);
    },
    setKeys(keys) { this._keys = new Set(keys); this._reset(); },
    addKey(k) { this._keys.add(k); this._reset(); },
    addKeys(arr) { arr.forEach(k => this._keys.add(k)); this._reset(); },
    setLive(latlng) { this._live = latlng; this._reset(); },
    _reset() {
      if (!this._map) return;
      const map = this._map;
      const tl = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this._canvas, tl);
      const s = map.getSize();
      if (this._canvas.width !== s.x) this._canvas.width = s.x;
      if (this._canvas.height !== s.y) this._canvas.height = s.y;
      this._draw();
    },
    _radiusPx() {
      const map = this._map;
      const lat = map.getCenter().lat;
      const mpp = 40075016.686 * Math.cos(lat * Math.PI / 180) / Math.pow(2, map.getZoom() + 8);
      return Math.max(16, 115 / mpp); // ~115 m revelados por celda
    },
    _hole(ctx, p, r) {
      const g = ctx.createRadialGradient(p.x, p.y, r * 0.45, p.x, p.y, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    },
    _draw() {
      const map = this._map, cv = this._canvas, ctx = cv.getContext("2d");
      const w = cv.width, h = cv.height;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(9,10,13,0.86)";
      ctx.fillRect(0, 0, w, h);
      const r = this._radiusPx();
      ctx.globalCompositeOperation = "destination-out";
      for (const key of this._keys) {
        const c = keyToCenter(key);
        const p = map.latLngToContainerPoint(c);
        if (p.x < -r || p.y < -r || p.x > w + r || p.y > h + r) continue;
        this._hole(ctx, p, r);
      }
      if (this._live) this._hole(ctx, map.latLngToContainerPoint(this._live), r * 1.3);
      ctx.globalCompositeOperation = "source-over";
    },
  });
  return new Fog(initialKeys);
}
