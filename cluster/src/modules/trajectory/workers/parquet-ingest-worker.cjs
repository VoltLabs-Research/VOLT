'use strict';

const { parentPort, workerData } = require('node:worker_threads');
const { DuckDBConnection } = require('@duckdb/node-api');
const { dataParser, dumpParser } = require('@voltstack/lammps-io');
const {
    buildElementTable,
    DEFAULT_UNITS,
    asLammpsUnits
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

// The native parsers throw (rather than return null) on a format mismatch, so try the
// dump parser first and fall back to the data parser on its failure. A LAMMPS dump
// always starts with `ITEM:`; a .data file never does — so the dump parser only throws
// on genuine .data input, making the fallback exact.
const readFrameFromFile = (filePath, includeProperties) => {
    try {
        return dumpParser.parseDump(filePath, {
            includeIds: true,
            properties: includeProperties ?? []
        });
    } catch (dumpError) {
        try {
            return dataParser.parseData(filePath, { includeIds: true });
        } catch (dataError) {
            throw new Error(
                `Unsupported trajectory format: ${filePath} ` +
                `(dump: ${dumpError.message}; data: ${dataError.message})`
            );
        }
    }
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

// DuckDB column DDL keyed by the daemon column dtype. i32 → INTEGER (signed 32-bit),
// f32 → FLOAT (single precision). Schema v2 carries the per-column dtype; there is no
// all-FLOAT v1 fallback.
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

// Resolve a per-column dtype map across all frames. A column is i32 only when every
// frame reports i32 for it; any frame that downgrades it to f32 wins (a later frame
// may carry a fractional value the first frame lacked).
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
    const customProperties = normalizeCustomPropertyNames(input.customProperties);
    const units = asLammpsUnits(input.units) ?? DEFAULT_UNITS;
    const connection = await DuckDBConnection.create();

    try {
        await connection.run(`SET threads TO ${readPositiveIntegerEnv('TRAJECTORY_PARQUET_DUCKDB_THREADS', DEFAULT_DUCKDB_THREADS)}`);

        const sortedFrames = [...input.frames].sort((a, b) => a.timestep - b.timestep);
        const parsedFrames = sortedFrames.map((frame) => ({
            timestep: frame.timestep,
            parsed: readFrameFromFile(frame.dumpPath, customProperties)
        }));

        const columnDtypes = resolveColumnDtypes(
            customProperties,
            parsedFrames.map((entry) => entry.parsed.propertyDtypes)
        );

        // Element table + units are derived once from the first frame's Masses /
        // element hints (the per-type identity is constant across a trajectory).
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
            `COPY (SELECT * FROM frames ORDER BY timestep, atom_index) TO ${sqlString(input.outputPath)} ` +
            '(FORMAT PARQUET, COMPRESSION ZSTD)'
        );

        return {
            columnDtypes,
            units,
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
