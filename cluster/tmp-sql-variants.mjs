import { DuckDBConnection } from '@duckdb/node-api';

const DOC = '/var/lib/volt-daemon/analysis-output/pipeline-6a7b2210e142fecc765f7e3c-0--28-qeIONlWCBtMj/stage-1_defect_mesh.parquet';
const SECTION = '$."export"."MeshExporter"';

const ms = () => Number(process.hrtime.bigint()) / 1e6;
const sql = (s) => `'${s.replace(/'/g, "''")}'`;
const src = `(SELECT payload FROM read_parquet(${sql(DOC)}) LIMIT 1)`;

const c = await DuckDBConnection.create();

const run = async (label, projection, out) => {
    const t0 = ms();
    try {
        await c.run(`COPY (${projection}) TO ${sql(out)} (FORMAT PARQUET, COMPRESSION ZSTD)`);
        const r = await c.runAndReadAll(
            `SELECT COUNT(*) AS n, SUM(vertex_id) AS idsum, ROUND(SUM(x + y + z), 3) AS coordsum FROM read_parquet(${sql(out)})`
        );
        const o = r.getRowObjectsJS()[0];
        console.log(`${label}: ${(ms() - t0).toFixed(0)} ms | n=${o.n} idsum=${o.idsum} coordsum=${o.coordsum}`);
    } catch (e) {
        console.log(`${label}: FAILED ${String(e.message).slice(0, 160)}`);
    }
};

/* A — current implementation: UNNEST(JSON[]) then 4 json_extract_string per row. */
await run(
    'A current (4x json_extract_string/row)',
    'WITH __items AS ('
    + `SELECT UNNEST(CAST(json_extract(payload, ${sql(`${SECTION}.vertices`)}) AS JSON[])) AS item FROM ${src}), `
    + '__ordered AS (SELECT ROW_NUMBER() OVER () - 1 AS ordinal, item FROM __items) '
    + 'SELECT ordinal AS slot, '
    + `TRY_CAST(json_extract_string(item, '$.index') AS BIGINT) AS vertex_id, `
    + `TRY_CAST(json_extract_string(item, '$.position[0]') AS DOUBLE) AS x, `
    + `TRY_CAST(json_extract_string(item, '$.position[1]') AS DOUBLE) AS y, `
    + `TRY_CAST(json_extract_string(item, '$.position[2]') AS DOUBLE) AS z `
    + 'FROM __ordered',
    '/tmp/v-a.parquet'
);

/* B — one from_json parse for the whole array, then plain struct field access. */
await run(
    'B from_json whole array',
    'WITH __parsed AS ('
    + `SELECT from_json(json_extract(payload, ${sql(`${SECTION}.vertices`)}), `
    + `${sql('[{"index":"BIGINT","position":"DOUBLE[]"}]')}) AS items FROM ${src}), `
    + '__rows AS (SELECT UNNEST(items) AS item, generate_subscripts(items, 1) - 1 AS ordinal FROM __parsed) '
    + 'SELECT ordinal AS slot, item.index AS vertex_id, '
    + 'item.position[1] AS x, item.position[2] AS y, item.position[3] AS z '
    + 'FROM __rows',
    '/tmp/v-b.parquet'
);

/* C — same single parse, but keeping UNNEST/ROW_NUMBER shape of the original. */
await run(
    'C from_json + ROW_NUMBER',
    'WITH __parsed AS ('
    + `SELECT UNNEST(from_json(json_extract(payload, ${sql(`${SECTION}.vertices`)}), `
    + `${sql('[{"index":"BIGINT","position":"DOUBLE[]"}]')})) AS item FROM ${src}) `
    + 'SELECT ROW_NUMBER() OVER () - 1 AS slot, item.index AS vertex_id, '
    + 'item.position[1] AS x, item.position[2] AS y, item.position[3] AS z '
    + 'FROM __parsed',
    '/tmp/v-c.parquet'
);

/* ---- facets: same comparison on the bigger array ---- */
const runF = async (label, projection, out) => {
    const t0 = ms();
    try {
        await c.run(`COPY (${projection}) TO ${sql(out)} (FORMAT PARQUET, COMPRESSION ZSTD)`);
        const r = await c.runAndReadAll(
            `SELECT COUNT(*) AS n, SUM(a + b + c) AS vsum FROM read_parquet(${sql(out)})`
        );
        const o = r.getRowObjectsJS()[0];
        console.log(`${label}: ${(ms() - t0).toFixed(0)} ms | n=${o.n} vsum=${o.vsum}`);
    } catch (e) {
        console.log(`${label}: FAILED ${String(e.message).slice(0, 160)}`);
    }
};

await runF(
    'FA current (4x json_extract_string/row)',
    'WITH __items AS ('
    + `SELECT UNNEST(CAST(json_extract(payload, ${sql(`${SECTION}.facets`)}) AS JSON[])) AS item FROM ${src}), `
    + '__ordered AS (SELECT ROW_NUMBER() OVER () - 1 AS ordinal, item FROM __items) '
    + 'SELECT ordinal AS ord, '
    + `TRY_CAST(json_extract_string(item, '$.vertices[0]') AS BIGINT) AS a, `
    + `TRY_CAST(json_extract_string(item, '$.vertices[1]') AS BIGINT) AS b, `
    + `TRY_CAST(json_extract_string(item, '$.vertices[2]') AS BIGINT) AS c `
    + 'FROM __ordered',
    '/tmp/f-a.parquet'
);

await runF(
    'FB from_json whole array',
    'WITH __parsed AS ('
    + `SELECT from_json(json_extract(payload, ${sql(`${SECTION}.facets`)}), `
    + `${sql('[{"vertices":"BIGINT[]"}]')}) AS items FROM ${src}), `
    + '__rows AS (SELECT UNNEST(items) AS item, generate_subscripts(items, 1) - 1 AS ordinal FROM __parsed) '
    + 'SELECT ordinal AS ord, item.vertices[1] AS a, item.vertices[2] AS b, item.vertices[3] AS c '
    + 'FROM __rows',
    '/tmp/f-b.parquet'
);

process.exit(0);
