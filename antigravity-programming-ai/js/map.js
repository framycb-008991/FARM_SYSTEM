/* ==========================================================================
   MECUZI FARM MANAGEMENT SYSTEM — Interactive Plot Map (Leaflet + GeoJSON)
   Deliverables B & C of the GIS plot-mapping feature.

   ONE tile/GeoJSON base, TWO cleanly separated modes (deliverable C):
     FarmMap.initReadOnly(containerId)  — Executive view: color-coded plot
       polygons with click popups (crop metadata, area, status). There are
       NO edit controls in this mode — and the API independently rejects
       writes from executive roles, so this is presentation, not security.
     FarmMap.initEditor(containerId)    — Field dashboard (Technician /
       Production Manager): point-by-point clicks or GPS walk-and-track
       (navigator.geolocation.watchPosition), polygon editing, crop metadata
       form, and an offline queue (localStorage) that syncs on reconnect —
       same offline-first pattern as every other field entry.

   Requires: Leaflet 1.9.x (CDN in index.html), js/geo.js (FarmGeo), i18n t().
   ========================================================================== */

(function (global) {
  'use strict';

  // Esri World Imagery — keyless satellite basemap suitable for field work
  const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const TILE_ATTR = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics';
  const MECUZI_CENTER = [-24.193, 34.738]; // farm centroid
  const QUEUE_KEY = 'mecuzi_plot_sync_queue';

  // Color-coding: deterministic per crop type (executive map legend, §C).
  const CROP_PALETTE = ['#2B7B13', '#C77700', '#1F6FB2', '#7B2BBF', '#B23030', '#0D8A8A', '#8A6D1D'];
  function cropColor(cropType) {
    if (!cropType) return '#6B7280';
    let h = 0;
    for (let i = 0; i < cropType.length; i++) h = (h * 31 + cropType.charCodeAt(i)) >>> 0;
    return CROP_PALETTE[h % CROP_PALETTE.length];
  }

  function plotStyle(plot) {
    const color = cropColor(plot.crop && plot.crop.cropType);
    return {
      color, weight: 2,
      fillColor: color,
      fillOpacity: plot.status === 'attention-needed' ? 0.55 : 0.35,
      dashArray: plot.status === 'fallow' ? '6 4' : null
    };
  }

  /* --- API access (same-origin session cookie; RBAC enforced server-side) --- */
  async function fetchPlots() {
    const res = await fetch('/api/plots', { credentials: 'same-origin' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || 'errors.server_error');
    return body.plots;
  }

  async function postPlot(payload) {
    const res = await fetch('/api/plots', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }

  async function patchPlot(id, payload) {
    const res = await fetch(`/api/plots/${encodeURIComponent(id)}`, {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }

  /* --- Offline queue (localStorage) — low-connectivity field usage --------- */
  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeQueue(items) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  }
  function enqueue(item) {
    const q = readQueue();
    q.push(item);
    writeQueue(q);
    return q.length;
  }
  async function flushQueue() {
    const q = readQueue();
    const remaining = [];
    for (const item of q) {
      const res = item.method === 'PATCH'
        ? await patchPlot(item.id, item.payload).catch(() => ({ status: 0 }))
        : await postPlot(item.payload).catch(() => ({ status: 0 }));
      // Keep only items that failed for network reasons; 4xx is a data problem
      if (res.status === 0) remaining.push(item);
    }
    writeQueue(remaining);
    return { synced: q.length - remaining.length, remaining: remaining.length };
  }

  /* --- Shared rendering ----------------------------------------------------- */
  function popupHtml(plot) {
    const c = plot.crop || {};
    const rows = [
      `<strong>${plot.name}</strong>`,
      `${t('map.popup_crop')}: ${c.cropType ? t(c.cropType) : '—'}${c.variety ? ` (${c.variety})` : ''}`,
      `${t('map.popup_stage')}: ${c.stage ? t(c.stage) : '—'}`,
      `${t('map.popup_area')}: <strong>${Number(plot.areaHectares).toLocaleString('pt-PT')} ha</strong>`,
      `${t('map.popup_status')}: ${t('map.status_' + String(plot.status).replace('-', '_'))}`
    ];
    return rows.join('<br>');
  }

  const instances = {}; // containerId -> { map, layerGroup, editor? }

  // Leaflet loads async from the CDN — wait for it, and degrade gracefully
  // if the device is offline (the rest of the app keeps working, §11-style).
  function whenLeafletReady(containerId, cb, attempts = 25) {
    if (typeof L !== 'undefined') return cb();
    if (attempts <= 0) {
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = `<div style="padding: 1rem; font-size: 12px; color: var(--color-text-muted);">${t('map.lib_unavailable')}</div>`;
      return;
    }
    setTimeout(() => whenLeafletReady(containerId, cb, attempts - 1), 300);
  }

  function initBase(containerId) {
    if (instances[containerId]) return instances[containerId];
    const map = L.map(containerId, { center: MECUZI_CENTER, zoom: 15, zoomControl: true });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    const layerGroup = L.layerGroup().addTo(map);
    instances[containerId] = { map, layerGroup };
    return instances[containerId];
  }

  async function renderPlots(inst, onPlotClick) {
    const plots = await fetchPlots();
    inst.layerGroup.clearLayers();
    const gj = L.geoJSON(plots.map(p => ({ type: 'Feature', geometry: p.geometry, properties: p })), {
      style: f => plotStyle(f.properties),
      onEachFeature: (f, layer) => {
        layer.bindPopup(popupHtml(f.properties));
        if (onPlotClick) layer.on('click', () => onPlotClick(f.properties));
      }
    }).addTo(inst.layerGroup);
    if (plots.length) {
      try { inst.map.fitBounds(gj.getBounds().pad(0.15)); } catch (e) { /* single point */ }
    }
    return plots;
  }

  /* --- Mode 1: Read-only executive view (deliverable C) --------------------- */
  async function initReadOnly(containerId) {
    whenLeafletReady(containerId, async () => {
      const inst = initBase(containerId);
      setTimeout(() => inst.map.invalidateSize(), 50); // hidden tab-pane sizing
      await renderPlots(inst, null).catch(() => {});
    });
    return instances[containerId] || null;
  }

  /* --- Mode 2: Editor (deliverable B) --------------------------------------- */
  function editorToolbarHtml() {
    return `
      <div class="map-toolbar">
        <button type="button" class="btn btn-secondary btn-sm" data-map-action="points">${t('map.btn_add_points')}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-map-action="gps">${t('map.btn_gps_track')}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-map-action="undo">${t('map.btn_undo')}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-map-action="clear">${t('map.btn_clear')}</button>
        <span class="badge badge-neutral" data-map-points>0 ${t('map.points')}</span>
        <span class="badge badge-warning" data-map-queue style="display:none"></span>
        <button type="button" class="btn btn-primary btn-sm" data-map-action="sync">${t('map.btn_sync')}</button>
      </div>`;
  }

  function editorFormHtml() {
    const cropOptions = ['crops.caju_dwarf', 'crops.caju_cowpea', 'crops.caju_clone', 'crops.vegetables', 'crops.caju_mixed', 'crops.green_manure', 'crops.cowpea_maize', 'crops.cowpea_b']
      .map(k => `<option value="${k}">${t(k)}</option>`).join('');
    const stageOptions = ['stages.vegetative', 'stages.flowering_maturing', 'stages.fruit_ripening', 'stages.staggered_harvest', 'stages.pruning_health', 'stages.harrowing_contouring']
      .map(k => `<option value="${k}">${t(k)}</option>`).join('');
    const statusOptions = ['on-track', 'attention-needed', 'fallow', 'harvest']
      .map(s => `<option value="${s}">${t('map.status_' + s.replace('-', '_'))}</option>`).join('');
    return `
      <div class="map-meta-form">
        <input type="text" class="form-control" data-map-field="name" placeholder="${t('map.f_name')}" required>
        <select class="form-control" data-map-field="cropType">${cropOptions}</select>
        <input type="text" class="form-control" data-map-field="variety" placeholder="${t('map.f_variety')}">
        <input type="date" class="form-control" data-map-field="plantingDate" title="${t('map.f_planting_date')}">
        <select class="form-control" data-map-field="stage">${stageOptions}</select>
        <select class="form-control" data-map-field="status">${statusOptions}</select>
        <button type="button" class="btn btn-primary btn-sm" data-map-action="save">${t('map.btn_save_plot')}</button>
      </div>`;
  }

  async function initEditor(containerId) {
    whenLeafletReady(containerId, () => initEditorInner(containerId));
    return instances[containerId] || null;
  }

  async function initEditorInner(containerId) {
    const inst = initBase(containerId);
    if (inst.editor) { setTimeout(() => inst.map.invalidateSize(), 50); return inst; }

    const container = document.getElementById(containerId).parentElement;
    container.insertAdjacentHTML('afterbegin', editorToolbarHtml());
    container.insertAdjacentHTML('beforeend', editorFormHtml());

    const ed = {
      drawing: null, // null | 'points' | 'gps'
      latlngs: [],
      watchId: null,
      polyline: L.polyline([], { color: '#FFD166', weight: 3 }).addTo(inst.map),
      editingPlotId: null
    };
    inst.editor = ed;

    const pointsBadge = container.querySelector('[data-map-points]');
    const queueBadge = container.querySelector('[data-map-queue]');
    const field = (k) => container.querySelector(`[data-map-field="${k}"]`);

    function refreshCapture() {
      ed.polyline.setLatLngs(ed.latlngs);
      pointsBadge.textContent = `${ed.latlngs.length} ${t('map.points')}`;
    }
    function refreshQueueBadge() {
      const n = readQueue().length;
      queueBadge.style.display = n ? '' : 'none';
      queueBadge.textContent = `${n} ${t('map.queued')}`;
    }
    function stopGps() {
      if (ed.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(ed.watchId);
      ed.watchId = null;
    }

    // Point-by-point capture: click/tap vertices directly on the satellite map
    inst.map.on('click', (e) => {
      if (ed.drawing !== 'points') return;
      ed.latlngs.push([e.latlng.lat, e.latlng.lng]);
      refreshCapture();
    });

    container.querySelector('[data-map-action="points"]').addEventListener('click', (e) => {
      stopGps();
      ed.drawing = ed.drawing === 'points' ? null : 'points';
      e.target.classList.toggle('active', ed.drawing === 'points');
    });

    // Walk-and-track: continuous GPS capture (HTML5 Geolocation watchPosition)
    container.querySelector('[data-map-action="gps"]').addEventListener('click', (e) => {
      if (ed.watchId != null) { stopGps(); ed.drawing = null; e.target.classList.remove('active'); return; }
      if (!navigator.geolocation) { showToast(t('map.gps_unavailable'), 'error'); return; }
      ed.drawing = 'gps';
      e.target.classList.add('active');
      ed.watchId = navigator.geolocation.watchPosition((pos) => {
        if (pos.coords.accuracy > 30) return; // drop noisy fixes
        const pt = [pos.coords.latitude, pos.coords.longitude];
        const last = ed.latlngs[ed.latlngs.length - 1];
        if (last && Math.abs(last[0] - pt[0]) < 0.00003 && Math.abs(last[1] - pt[1]) < 0.00003) return; // ~3m
        ed.latlngs.push(pt);
        refreshCapture();
      }, () => showToast(t('map.gps_unavailable'), 'error'),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 });
    });

    container.querySelector('[data-map-action="undo"]').addEventListener('click', () => {
      ed.latlngs.pop();
      refreshCapture();
    });
    container.querySelector('[data-map-action="clear"]').addEventListener('click', () => {
      stopGps();
      ed.drawing = null;
      ed.latlngs = [];
      ed.editingPlotId = null;
      refreshCapture();
    });

    container.querySelector('[data-map-action="sync"]').addEventListener('click', async () => {
      const res = await flushQueue();
      refreshQueueBadge();
      await renderPlots(inst, loadForEdit).catch(() => {});
      showToast(`${res.synced} ${t('status.synced')} · ${res.remaining} ${t('map.queued')}`, res.remaining ? 'warning' : 'success');
    });

    // Load an existing plot into the editor for boundary/metadata edits
    async function loadForEdit(plot) {
      ed.editingPlotId = plot.id;
      ed.latlngs = plot.geometry.coordinates[0].slice(0, -1).map(p => [p[1], p[0]]);
      refreshCapture();
      field('name').value = plot.name;
      if (plot.crop) {
        field('cropType').value = plot.crop.cropType || field('cropType').value;
        field('variety').value = plot.crop.variety || '';
        field('plantingDate').value = plot.crop.plantingDate ? String(plot.crop.plantingDate).slice(0, 10) : '';
        field('stage').value = plot.crop.stage || field('stage').value;
      }
      field('status').value = plot.status;
      showToast(`${plot.name} — ${t('map.editing')}`, 'navy');
    }

    container.querySelector('[data-map-action="save"]').addEventListener('click', async () => {
      const built = FarmGeo.polygonFromCapturedLatLngs(ed.latlngs);
      if (!built.ok) { showToast(t(built.error), 'error'); return; }
      const name = field('name').value.trim();
      if (!name) { showToast(t('map.f_name'), 'error'); return; }
      const crop = {
        cropType: field('cropType').value,
        variety: field('variety').value.trim(),
        plantingDate: field('plantingDate').value || null,
        stage: field('stage').value
      };
      const payload = { name, geometry: built.geometry, status: field('status').value, crop };

      // Offline-first: a failed/unreachable POST queues locally and syncs
      // later — client-generated ID keeps retries idempotent (BACKEND_SPEC §5)
      let res;
      if (ed.editingPlotId) {
        res = navigator.onLine === false ? { status: 0 } : await patchPlot(ed.editingPlotId, payload).catch(() => ({ status: 0 }));
        if (res.status === 0) { enqueue({ method: 'PATCH', id: ed.editingPlotId, payload }); showToast(t('map.saved_offline'), 'warning'); }
        else if (res.status !== 200) { showToast(t(res.body.error || 'errors.server_error'), 'error'); return; }
        else showToast(`${name} — ${t('map.plot_updated')}`, 'success');
      } else {
        payload.id = `PLOT-UUID-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        res = navigator.onLine === false ? { status: 0 } : await postPlot(payload).catch(() => ({ status: 0 }));
        if (res.status === 0) { enqueue({ method: 'POST', payload }); showToast(t('map.saved_offline'), 'warning'); }
        else if (res.status !== 201 && res.status !== 200) { showToast(t(res.body.error || 'errors.server_error'), 'error'); return; }
        else showToast(`${name} — ${built.areaHectares} ha`, 'success');
      }

      stopGps();
      ed.drawing = null;
      ed.latlngs = [];
      ed.editingPlotId = null;
      refreshCapture();
      refreshQueueBadge();
      await renderPlots(inst, loadForEdit).catch(() => {});
    });

    // Auto-flush the offline queue when connectivity returns
    window.addEventListener('online', async () => {
      const res = await flushQueue();
      refreshQueueBadge();
      if (res.synced) showToast(`${res.synced} ${t('status.synced')}`, 'success');
    });

    setTimeout(() => inst.map.invalidateSize(), 50);
    await renderPlots(inst, loadForEdit).catch(() => {});
    refreshQueueBadge();
    return inst;
  }

  global.FarmMap = { initReadOnly, initEditor, flushQueue, readQueue };

})(typeof window !== 'undefined' ? window : globalThis);
