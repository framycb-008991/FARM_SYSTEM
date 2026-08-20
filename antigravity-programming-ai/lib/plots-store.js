/* ==========================================================================
   Plots store — data access for GIS plot mapping (deliverable D backing).
   Two interchangeable backends behind ONE interface:
     - SQL:  any pg-compatible pool exposed by lib/demo-db.js (`db.query`),
             used in production (Render Postgres) and in tests (pg-mem);
     - MEM:  in-memory Maps, used when the server runs with the mock demo
             database (MOCK_DEMO_AUTH_ENABLED) so the map works with no DB.
   Role enforcement lives in server.js; this layer only persists.
   ========================================================================== */
'use strict';

function rowToPlot(row, crop) {
  return {
    id: row.id,
    name: row.name,
    geometry: typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry,
    areaHectares: Number(row.area_hectares),
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    crop: crop || null
  };
}

function rowToCrop(row) {
  if (!row) return null;
  return {
    id: row.id,
    plotId: row.plot_id,
    cropType: row.crop_type,
    variety: row.variety,
    plantingDate: row.planting_date,
    stage: row.stage,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at
  };
}

/* --- SQL backend (pg / pg-mem) --- */
function createSqlPlotsStore(db) {
  return {
    async listPlots() {
      const plots = (await db.query('SELECT * FROM plots ORDER BY created_at')).rows;
      const crops = (await db.query('SELECT * FROM crop_records')).rows;
      const byPlot = new Map(crops.map(c => [c.plot_id, rowToCrop(c)]));
      return plots.map(p => rowToPlot(p, byPlot.get(p.id) || null));
    },
    async getPlot(id) {
      const row = (await db.query('SELECT * FROM plots WHERE id = $1', [id])).rows[0];
      if (!row) return null;
      const crop = rowToCrop((await db.query('SELECT * FROM crop_records WHERE plot_id = $1', [id])).rows[0]);
      return rowToPlot(row, crop);
    },
    async createPlot(plot, crop) {
      const client = db; // demo-db exposes only query(); transactional safety is best-effort here
      await client.query(`
        INSERT INTO plots (id, name, geometry, area_hectares, status, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$6)
      `, [plot.id, plot.name, JSON.stringify(plot.geometry), plot.areaHectares,
        plot.status || 'active', plot.actor]);
      if (crop) await upsertCropSql(client, plot.id, crop, plot.actor);
      return this.getPlot(plot.id);
    },
    async updatePlot(id, patch, crop, actor) {
      const existing = await this.getPlot(id);
      if (!existing) return null;
      await db.query(`
        UPDATE plots SET
          name = $2, geometry = $3, area_hectares = $4, status = $5,
          updated_by = $6, updated_at = NOW()
        WHERE id = $1
      `, [id, patch.name || existing.name, JSON.stringify(patch.geometry || existing.geometry),
        patch.areaHectares != null ? patch.areaHectares : existing.areaHectares,
        patch.status || existing.status, actor]);
      if (crop) await upsertCropSql(db, id, crop, actor);
      return this.getPlot(id);
    },
    async close() { /* pool lifecycle owned by demo-db */ }
  };
}

async function upsertCropSql(db, plotId, crop, actor) {
  await db.query(`
    INSERT INTO crop_records (id, plot_id, crop_type, variety, planting_date, stage, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (plot_id) DO UPDATE SET
      crop_type = EXCLUDED.crop_type, variety = EXCLUDED.variety,
      planting_date = EXCLUDED.planting_date, stage = EXCLUDED.stage,
      updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `, [crop.id || `CR-${plotId}`, plotId, crop.cropType, crop.variety || null,
    crop.plantingDate || null, crop.stage || null, actor]);
}

/* --- In-memory backend (mock demo database mode) --- */
function createMemoryPlotsStore() {
  const plots = new Map();
  const crops = new Map();
  return {
    async listPlots() {
      return [...plots.values()].map(p => Object.assign({}, p, { crop: crops.get(p.id) || null }));
    },
    async getPlot(id) {
      const p = plots.get(id);
      return p ? Object.assign({}, p, { crop: crops.get(id) || null }) : null;
    },
    async createPlot(plot, crop) {
      plots.set(plot.id, {
        id: plot.id, name: plot.name, geometry: plot.geometry,
        areaHectares: plot.areaHectares, status: plot.status || 'active',
        createdBy: plot.actor, updatedBy: plot.actor,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      if (crop) {
        crops.set(plot.id, { id: crop.id || `CR-${plot.id}`, plotId: plot.id,
          cropType: crop.cropType, variety: crop.variety || null,
          plantingDate: crop.plantingDate || null, stage: crop.stage || null,
          updatedBy: plot.actor, updatedAt: new Date().toISOString() });
      }
      return this.getPlot(plot.id);
    },
    async updatePlot(id, patch, crop, actor) {
      const existing = plots.get(id);
      if (!existing) return null;
      plots.set(id, Object.assign({}, existing, {
        name: patch.name || existing.name,
        geometry: patch.geometry || existing.geometry,
        areaHectares: patch.areaHectares != null ? patch.areaHectares : existing.areaHectares,
        status: patch.status || existing.status,
        updatedBy: actor, updatedAt: new Date().toISOString()
      }));
      if (crop) {
        crops.set(id, { id: crop.id || `CR-${id}`, plotId: id,
          cropType: crop.cropType, variety: crop.variety || null,
          plantingDate: crop.plantingDate || null, stage: crop.stage || null,
          updatedBy: actor, updatedAt: new Date().toISOString() });
      }
      return this.getPlot(id);
    },
    async close() { plots.clear(); crops.clear(); }
  };
}

// The pg-backed demo database exposes `query`; the mock demo database does
// not — that is the backend switch.
function createPlotsStore(db) {
  return (db && typeof db.query === 'function') ? createSqlPlotsStore(db) : createMemoryPlotsStore();
}

module.exports = { createPlotsStore };
