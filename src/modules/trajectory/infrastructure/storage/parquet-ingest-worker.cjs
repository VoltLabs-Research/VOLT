'use strict';

const { parentPort, workerData } = require('node:worker_threads');
const { DuckDBConnection } = require('@duckdb/node-api');
const { dataParser, dumpParser } = require('@voltstack/lammps-io');

const BASE_COLUMNS = ['timestep', 'atom_index', 'id', 'type', 'x', 'y', 'z'];
const BASE_COLUMN_SET = new Set(BASE_COLUMNS);
const DEFAULT_DUCKDB_THREADS = 1;

const quoteIdentifier = (value) => `"${value.replace(/"/g, '""')}"`;

const sqlString = (value) => `'${value.replace(/'/g, "''")}'`;

const readPositiveIntegerEnv = (name, fallback) => {
    const value = process.env[name];
    if (!value || !/^[1-9]\d*$/.test(value)) return fallback;
    return Number.parseInt(value, 10);
};

const readFrameFromFile = (filePath, includeProperties) => {
    const dumpResult = dumpParser.parseDump(filePath, {
        includeIds: true,
        properties: includeProperties ?? []
    });
    if (dumpResult) return dumpResult;

    const dataResult = dataParser.parseData(filePath, { includeIds: true });
    if (dataResult) return dataResult;

    throw new Error(`Unsupported trajectory format: ${filePath}`);
};

const toFloat32PropertyMap = (properties) => {
    if (!properties) return undefined;
    const entries = Object.entries(properties);
    if (entries.length === 0) return undefined;
    const result = {};
    for (const [name, values] of entries) {
        if (values instanceof Float32Array) {
            result[name] = values;
            continue;
        }
        if (values instanceof Float64Array) {
            result[name] = Float32Array.from(values);
            continue;
        }
        result[name] = Float32Array.from(values);
    }
    return result;
};

const normalizeCustomPropertyNames = (properties) => {
    const seen = new Set();
    const result = [];

    for (const property of properties ?? []) {
        const name = property.trim();
        if (!name || BASE_COLUMN_SET.has(name) || seen.has(name)) continue;
        seen.add(name);
        result.push(name);
    }

    return result;
};

const createFramesTable = async (connection, customProperties) => {
    const propertyColumns = customProperties
        .map((property) => `${quoteIdentifier(property)} FLOAT`)
        .join(', ');
    await connection.run(
        'CREATE TABLE frames (' +
        'timestep BIGINT NOT NULL, ' +
        'atom_index UINTEGER NOT NULL, ' +
        'id UINTEGER, ' +
        'type USMALLINT NOT NULL, ' +
        'x FLOAT NOT NULL, ' +
        'y FLOAT NOT NULL, ' +
        'z FLOAT NOT NULL' +
        (propertyColumns ? `, ${propertyColumns}` : '') +
        ')'
    );
};

const appendFrame = (appender, timestep, parsed, customProperties) => {
    const atomCount = parsed.positions.length / 3;
    const properties = toFloat32PropertyMap(parsed.properties) ?? {};

    for (let atomIndex = 0; atomIndex < atomCount; atomIndex++) {
        appender.appendBigInt(BigInt(timestep));
        appender.appendUInteger(atomIndex);

        if (parsed.ids) {
            appender.appendUInteger(Number(parsed.ids[atomIndex]));
        } else {
            appender.appendNull();
        }

        appender.appendUSmallInt(parsed.types[atomIndex]);
        appender.appendFloat(parsed.positions[atomIndex * 3]);
        appender.appendFloat(parsed.positions[atomIndex * 3 + 1]);
        appender.appendFloat(parsed.positions[atomIndex * 3 + 2]);

        for (const property of customProperties) {
            const values = properties[property];
            if (values) {
                appender.appendFloat(values[atomIndex]);
            } else {
                appender.appendNull();
            }
        }

        appender.endRow();
    }
};

const buildParquet = async (input) => {
    const customProperties = normalizeCustomPropertyNames(input.customProperties);
    const connection = await DuckDBConnection.create();

    try {
        await connection.run(`SET threads TO ${readPositiveIntegerEnv('TRAJECTORY_PARQUET_DUCKDB_THREADS', DEFAULT_DUCKDB_THREADS)}`);
        await createFramesTable(connection, customProperties);
        const appender = await connection.createAppender('frames');
        try {
            const sortedFrames = [...input.frames].sort((a, b) => a.timestep - b.timestep);
            for (const frame of sortedFrames) {
                const parsed = readFrameFromFile(frame.dumpPath, customProperties);
                appendFrame(appender, frame.timestep, parsed, customProperties);
            }
        } finally {
            appender.closeSync();
        }

        await connection.run(
            `COPY (SELECT * FROM frames ORDER BY timestep, atom_index) TO ${sqlString(input.outputPath)} ` +
            '(FORMAT PARQUET, COMPRESSION ZSTD)'
        );
    } finally {
        connection.closeSync();
    }
};

if (!parentPort) {
    throw new Error('Parquet ingest worker requires a parent port');
}

buildParquet(workerData)
    .then(() => parentPort.postMessage({ ok: true }))
    .catch((error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        parentPort.postMessage({
            ok: false,
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack
            }
        });
    });
