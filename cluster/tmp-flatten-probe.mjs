import { DuckDBConnection } from '@duckdb/node-api';

const DOC = '/var/lib/volt-daemon/analysis-output/pipeline-6a7b2210e142fecc765f7e3c-0--28-qeIONlWCBtMj/stage-1_defect_mesh.parquet';
const OUT = '/tmp/probe-flatten';
const SECTION = '$."export"."MeshExporter"';

const ms = () => Number(process.hrtime.bigint()) / 1e6;
const sql = (s) => `'${s.replace(/'/g, "''")}'`;
const payloadSource = (f) => `(SELECT payload FROM read_parquet(${sql(f)}) LIMIT 1)`;
const unnestedArray = (f, valuePath) =>
    'WITH __items AS ('
    + `SELECT UNNEST(CAST(json_extract(payload, ${sql(valuePath)}) AS JSON[])) AS item `
    + `FROM ${payloadSource(f)}), `
    + '__ordered AS (SELECT ROW_NUMBER() OVER () - 1 AS ordinal, item FROM __items)';
const copyToParquet = (projection, outputPath) =>
    `COPY (${projection}) TO ${sql(outputPath)} (FORMAT PARQUET, COMPRESSION ZSTD)`;

const c = await DuckDBConnection.create();

let t0 = ms();
const type = await c.runAndReadAll(
    `SELECT json_type(json_extract(payload, ${sql(`${SECTION}.vertices`)})) AS t FROM ${payloadSource(DOC)}`
);
console.log('json_type(vertices):', type.getRowObjectsJS()[0]?.t, `${(ms() - t0).toFixed(0)} ms`);

t0 = ms();
await c.run(copyToParquet(
    `${unnestedArray(DOC, `${SECTION}.vertices`)} `
    + 'SELECT ordinal AS slot, '
    + `TRY_CAST(json_extract_string(item, '$.index') AS BIGINT) AS vertex_id, `
    + `TRY_CAST(json_extract_string(item, '$.position[0]') AS DOUBLE) AS x, `
    + `TRY_CAST(json_extract_string(item, '$.position[1]') AS DOUBLE) AS y, `
    + `TRY_CAST(json_extract_string(item, '$.position[2]') AS DOUBLE) AS z `
    + 'FROM __ordered',
    `${OUT}.vertices.parquet`
));
console.log(`COPY vertices: ${(ms() - t0).toFixed(0)} ms`);

t0 = ms();
await c.run(copyToParquet(
    `${unnestedArray(DOC, `${SECTION}.facets`)} `
    + 'SELECT ordinal AS ord, '
    + `TRY_CAST(json_extract_string(item, '$.vertices[0]') AS BIGINT) AS a, `
    + `TRY_CAST(json_extract_string(item, '$.vertices[1]') AS BIGINT) AS b, `
    + `TRY_CAST(json_extract_string(item, '$.vertices[2]') AS BIGINT) AS c `
    + 'FROM __ordered',
    `${OUT}.facets.parquet`
));
console.log(`COPY facets: ${(ms() - t0).toFixed(0)} ms`);

process.exit(0);
