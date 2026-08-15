'use strict';

const { parentPort, workerData } = require('node:worker_threads');
const path = require('node:path');
const { DuckDBConnection } = require('@duckdb/node-api');
const { readFrame } = require('@voltstack/lammps-io');
const {
    buildElementTable,
    DEFAULT_UNITS
} = require('./element-table.cjs');

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

const readFrameFromFile = (filePath) => readFrame(filePath, {
    includeIds: true,
    properties: ['*']
});

const collectCustomPropertyNames = (parsedFrames) => {
    const seen = new Set();
    const names = [];

    for (const { parsed } of parsedFrames) {
        for (const name of Object.keys(parsed.properties ?? {})) {
            if (!name || BASE_COLUMN_SET.has(name) || seen.has(name)) continue;
            seen.add(name);
            names.push(name);
        }
    }

    return names;
};

const duckdbColumnType = (dtype) => (dtype === 'i32' ? 'INTEGER' : 'FLOAT');

const createFramesTable = async (connection, customProperties, columnDtypes) => {
    const propertyColumns = customProperties
        .map((property) => `${quoteIdentifier(property)} ${duckdbColumnType(columnDtypes[property])}`)
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

const appendFrame = (appender, timestep, parsed, customProperties, columnDtypes) => {
    const atomCount = parsed.positions.length / 3;
    const properties = parsed.properties ?? {};

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
            if (!values) {
                appender.appendNull();
                continue;
            }
            if (columnDtypes[property] === 'i32') {
                appender.appendInteger(values[atomIndex]);
            } else {
                appender.appendFloat(values[atomIndex]);
            }
        }

        appender.endRow();
    }
};

const resolveColumnDtypes = (customProperties, frameDtypes) => {
    const result = {};
    for (const property of customProperties) {
        let dtype = 'i32';
        for (const dtypes of frameDtypes) {
            if ((dtypes?.[property] ?? 'f32') !== 'i32') {
                dtype = 'f32';
                break;
            }
        }
        result[property] = dtype;
    }
    return result;
};

const buildParquet = async (input) => {
    const connection = await DuckDBConnection.create();

    try {
        await connection.run(`SET threads TO ${readPositiveIntegerEnv('TRAJECTORY_PARQUET_DUCKDB_THREADS', DEFAULT_DUCKDB_THREADS)}`);
        await connection.run(`SET temp_directory TO ${sqlString(path.dirname(input.outputPath))}`);

        const sortedFrames = [...input.frames].sort((a, b) => a.timestep - b.timestep);
        const parsedFrames = sortedFrames.map((frame) => ({
            timestep: frame.timestep,
            parsed: readFrameFromFile(frame.dumpPath)
        }));

        const customProperties = collectCustomPropertyNames(parsedFrames);
        const columnDtypes = resolveColumnDtypes(
            customProperties,
            parsedFrames.map((entry) => entry.parsed.propertyDtypes)
        );

        const firstParsed = parsedFrames[0]?.parsed;
        const typeCount = firstParsed ? maxType(firstParsed.types) : 0;
        const elementTable = buildElementTable({
            typeCount,
            massesByType: firstParsed?.massesByType,
            elementHintsByType: firstParsed?.elementHintsByType
        });

        await createFramesTable(connection, customProperties, columnDtypes);
        const appender = await connection.createAppender('frames');
        try {
            for (const { timestep, parsed } of parsedFrames) {
                appendFrame(appender, timestep, parsed, customProperties, columnDtypes);
            }
        } finally {
            appender.closeSync();
        }

        await connection.run(
            `COPY frames TO ${sqlString(input.outputPath)} (FORMAT PARQUET, COMPRESSION ZSTD)`
        );

        return {
            columnDtypes,
            units: DEFAULT_UNITS,
            elementTable
        };
    } finally {
        connection.closeSync();
    }
};

const maxType = (types) => {
    let max = 0;
    for (let index = 0; index < types.length; index++) {
        if (types[index] > max) max = types[index];
    }
    return max;
};

if (!parentPort) {
    throw new Error('Parquet ingest worker requires a parent port');
}

buildParquet(workerData)
    .then((result) => parentPort.postMessage({
        ok: true,
        result
    }))
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
