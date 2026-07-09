// ================= Tracker de GPS / velocidad =================

const MS_TO_KMH = 3.6;

export function haversine(a, b) {
  const R = 6371000; // m
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function bearing(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
            Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

export class Tracker {
  constructor({ onUpdate, onAutoStart } = {}) {
    this.onUpdate = onUpdate || (() => {});
    this.onAutoStart = onAutoStart || (() => {});
    this.watchId = null;
    this.armed = false;          // escuchando GPS (esperando movimiento o grabando)
    this.recording = false;      // grabando el manejo
    this.points = [];            // [{lat,lng,speed(km/h),t}]
    this.lastPos = null;
    this.lastT = null;
    this.startT = null;
    this.maxSpeed = 0;
    this.distance = 0;           // metros
    this.AUTO_START_KMH = 10;    // arranca solo al superar esto
  }

  isSupported() { return "geolocation" in navigator; }

  // Arranca el "modo escucha". Si autoRecord=false, sólo detecta movimiento
  // y dispara onAutoStart cuando superas 10 km/h.
  arm(autoRecord = false) {
    if (!this.isSupported()) throw new Error("Este dispositivo no tiene GPS disponible.");
    this.armed = true;
    if (autoRecord) this._beginRecording();
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPos(pos),
      (err) => this.onUpdate({ error: err.message || "Error de GPS", code: err.code }),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 }
    );
  }

  _beginRecording() {
    this.recording = true;
    this.points = [];
    this.lastPos = null;
    this.lastT = null;
    this.startT = Date.now();
    this.maxSpeed = 0;
    this.distance = 0;
  }

  _onPos(pos) {
    const now = pos.timestamp || Date.now();
    const c = pos.coords;
    const cur = { lat: c.latitude, lng: c.longitude };

    // velocidad: preferimos la del GPS; si viene null la calculamos
    let kmh;
    if (c.speed != null && !Number.isNaN(c.speed) && c.speed >= 0) {
      kmh = c.speed * MS_TO_KMH;
    } else if (this.lastPos && this.lastT) {
      const dist = haversine(this.lastPos, cur);
      const dt = (now - this.lastT) / 1000;
      kmh = dt > 0 ? (dist / dt) * MS_TO_KMH : 0;
    } else {
      kmh = 0;
    }
    kmh = Math.max(0, Math.min(kmh, 320)); // recorte anti-glitch

    // auto-start al superar el umbral
    if (this.armed && !this.recording && kmh >= this.AUTO_START_KMH) {
      this._beginRecording();
      this.onAutoStart();
    }

    if (this.recording) {
      if (this.lastPos) {
        const d = haversine(this.lastPos, cur);
        if (d < 400) this.distance += d; // ignora saltos de GPS
      }
      if (kmh > this.maxSpeed) this.maxSpeed = kmh;
      this.points.push({ lat: cur.lat, lng: cur.lng, speed: kmh, t: now, acc: c.accuracy });
    }

    this.lastPos = cur;
    this.lastT = now;

    const elapsed = this.startT ? (Date.now() - this.startT) / 1000 : 0;
    const avg = this.recording && elapsed > 0 ? (this.distance / elapsed) * MS_TO_KMH : 0;
    this.onUpdate({
      speed: kmh,
      lat: cur.lat, lng: cur.lng,
      accuracy: c.accuracy,
      recording: this.recording,
      distanceKm: this.distance / 1000,
      avgSpeed: avg,
      maxSpeed: this.maxSpeed,
      elapsed,
    });
  }

  // Detiene todo y regresa el manejo capturado
  stop() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.armed = false;
    const wasRecording = this.recording;
    this.recording = false;

    const elapsed = this.startT ? (Date.now() - this.startT) / 1000 : 0;
    const drive = {
      points: this.points.slice(),
      distanceKm: this.distance / 1000,
      durationSec: elapsed,
      maxSpeed: Math.round(this.maxSpeed),
      avgSpeed: elapsed > 0 ? Math.round((this.distance / elapsed) * MS_TO_KMH) : 0,
      startedAt: this.startT,
    };
    return wasRecording ? drive : null;
  }
}
