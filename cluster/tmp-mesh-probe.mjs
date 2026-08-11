import { DuckDBConnection } from '@duckdb/node-api';

const DIR = '/var/lib/volt-daemon/analysis-output/pipeline-6a7b2210e142fecc765f7e3c-0--28-qeIONlWCBtMj';
const V = `${DIR}/stage-1_defect_mesh.parquet.export.MeshExporter.mesh-vertices.parquet`;
const F = `${DIR}/stage-1_defect_mesh.parquet.export.MeshExporter.mesh-facets.parquet`;

const ms = () => Number(process.hrtime.bigint()) / 1e6;
const sql = (s) => `'${s.replace(/'/g, "''")}'`;
const tick = () => new Promise((res) => setImmediate(res));

const c = await DuckDBConnection.create();

let t0 = ms();
const counts = (await c.runAndReadAll(
    `SELECT (SELECT COUNT(*) FROM read_parquet(${sql(V)})) AS v, `
    + `(SELECT COUNT(*) FROM read_parquet(${sql(F)})) AS f`
)).getRowObjectsJS()[0];
const vertexCount = Number(counts.v);
const facetCount = Number(counts.f);
console.log(`counts: v=${vertexCount} f=${facetCount} in ${(ms() - t0).toFixed(0)} ms`);

// ---- phase 1: vertices, exactly as mesh-exporter.ts does it
{
    const positions = new Float32Array(vertexCount * 3);
    const start = ms();
    const r = await c.stream(`SELECT x, y, z FROM read_parquet(${sql(V)}) ORDER BY slot`);
    const afterStream = ms();
    let waiting = 0, loop = 0, yielding = 0, chunks = 0, off = 0;
    let w0 = ms();
    for (let chunk = await r.fetchChunk(); chunk; chunk = await r.fetchChunk()) {
        waiting += ms() - w0;
        const rows = chunk.rowCount;
        if (rows === 0) break;
        const j0 = ms();
        const xs = chunk.getColumnVector(0);
        const ys = chunk.getColumnVector(1);
        const zs = chunk.getColumnVector(2);
        for (let row = 0; row < rows; row += 1) {
            const base = off * 3;
            positions[base] = Number(xs.getItem(row) ?? 0);
            positions[base + 1] = Number(ys.getItem(row) ?? 0);
            positions[base + 2] = Number(zs.getItem(row) ?? 0);
            off += 1;
        }
        loop += ms() - j0;
        chunks += 1;
        const y0 = ms();
        await tick();
        yielding += ms() - y0;
        w0 = ms();
    }
    console.log(`vertices CURRENT: total ${(ms() - start).toFixed(0)} ms | stream() ${(afterStream - start).toFixed(0)} | awaiting chunks ${waiting.toFixed(0)} | JS getItem loop ${loop.toFixed(0)} | setImmediate ${yielding.toFixed(0)} | chunks ${chunks} rows ${off}`);
}

// ---- phase 2: triangles with the 3-way join, exactly as mesh-exporter.ts does it
{
    const indices = new Uint32Array(facetCount * 3);
    const start = ms();
    const r = await c.stream(
        'WITH vertex_map AS ('
        + `SELECT vertex_id, MAX(slot) AS slot FROM read_parquet(${sql(V)}) `
        + 'WHERE vertex_id IS NOT NULL GROUP BY vertex_id) '
        + 'SELECT va.slot AS ia, vb.slot AS ib, vc.slot AS ic '
        + `FROM read_parquet(${sql(F)}) f `
        + 'JOIN vertex_map va ON va.vertex_id = f.a '
        + 'JOIN vertex_map vb ON vb.vertex_id = f.b '
        + 'JOIN vertex_map vc ON vc.vertex_id = f.c '
        + 'ORDER BY f.ord'
    );
    const afterStream = ms();
    let waiting = 0, loop = 0, yielding = 0, chunks = 0, off = 0;
    let w0 = ms();
    for (let chunk = await r.fetchChunk(); chunk; chunk = await r.fetchChunk()) {
        waiting += ms() - w0;
        const rows = chunk.rowCount;
        if (rows === 0) break;
        const j0 = ms();
        const ia = chunk.getColumnVector(0);
        const ib = chunk.getColumnVector(1);
        const ic = chunk.getColumnVector(2);
        for (let row = 0; row < rows; row += 1) {
            indices[off] = Number(ia.getItem(row) ?? 0);
            indices[off + 1] = Number(ib.getItem(row) ?? 0);
            indices[off + 2] = Number(ic.getItem(row) ?? 0);
            off += 3;
        }
        loop += ms() - j0;
        chunks += 1;
        const y0 = ms();
        await tick();
        yielding += ms() - y0;
        w0 = ms();
    }
    console.log(`triangles CURRENT: total ${(ms() - start).toFixed(0)} ms | stream() ${(afterStream - start).toFixed(0)} | awaiting chunks ${waiting.toFixed(0)} | JS getItem loop ${loop.toFixed(0)} | setImmediate ${yielding.toFixed(0)} | chunks ${chunks} triangles ${off / 3}`);
}

// ---- what the vector API actually offers
{
    const r = await c.stream(`SELECT x FROM read_parquet(${sql(V)}) LIMIT 4096`);
    const chunk = await r.fetchChunk();
    const vec = chunk.getColumnVector(0);
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(vec));
    console.log('vector proto:', proto.join(','));
    console.log('chunk proto:', Object.getOwnPropertyNames(Object.getPrototypeOf(chunk)).join(','));
}

await c.disconnectSync?.();
process.exit(0);
