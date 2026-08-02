import type { DuckDBConnection } from '@duckdb/node-api';
import {
    type AtomId,
    type AtomPropertyValue,
    type PerAtomColumnarData,
    type PerAtomProperties,
    flattenAtomProperties,
    normalizeAtomId
} from '@modules/plugin/services/properties/PluginAtomProperties';
import {
    type PropertyColumn,
    getColumnarRowCount,
    toFiniteNumber
} from '@modules/plugin/services/properties/parquet-property-schema';
import { quoteIdentifier } from '@modules/plugin/services/properties/duckdb-sql-escaping';

/** Writes per-atom plugin properties into the `plugin_properties` DuckDB table. */

export const PROPERTIES_TABLE_NAME = 'plugin_properties';

type DuckDBAppender = Awaited<ReturnType<DuckDBConnection['createAppender']>>;

export const createPropertiesTable = async (
    connection: DuckDBConnection,
    columns: PropertyColumn[]
): Promise<void> => {
    const propertyColumns = columns
        .map((column) => `${quoteIdentifier(column.name)} ${column.type === 'double' ? 'DOUBLE' : 'VARCHAR'}`)
        .join(', ');
    await connection.run(
        `CREATE TABLE ${PROPERTIES_TABLE_NAME} (` +
        'timestep BIGINT NOT NULL, ' +
        'atom_index UINTEGER NOT NULL, ' +
        'id UBIGINT' +
        (propertyColumns ? `, ${propertyColumns}` : '') +
        ')'
    );
};

const appendPropertyValue = (appender: DuckDBAppender, column: PropertyColumn, value: unknown): void => {
    if (value === null || value === undefined) {
        appender.appendNull();
        return;
    }

    if (column.type === 'double') {
        const numeric = toFiniteNumber(value);
        if (numeric === null) {
            appender.appendNull();
        } else {
            appender.appendDouble(numeric);
        }
        return;
    }

    appender.appendVarchar(String(value));
};

const appendRowHeader = (
    appender: DuckDBAppender,
    timestep: number,
    atomIndex: number,
    atomId: number | null
): void => {
    appender.appendBigInt(BigInt(timestep));
    appender.appendUInteger(atomIndex);
    if (atomId === null) {
        appender.appendNull();
    } else {
        appender.appendUBigInt(BigInt(atomId));
    }
};

const readColumnarValue = (
    rows: PerAtomColumnarData,
    atomIndex: number,
    column: PropertyColumn
): AtomPropertyValue | undefined => {
    if (!column.sourceName) return undefined;

    const value = rows[column.sourceName]?.[atomIndex];
    if (column.vectorIndex !== undefined) {
        return Array.isArray(value) ? value[column.vectorIndex] : undefined;
    }

    return Array.isArray(value) ? undefined : value;
};

export const appendProperties = (
    appender: DuckDBAppender,
    timestep: number,
    rows: PerAtomProperties,
    columns: PropertyColumn[]
): void => {
    if (Array.isArray(rows)) {
        let atomIndex = 0;
        for (const row of rows) {
            const flatRow = flattenAtomProperties(row);
            appendRowHeader(appender, timestep, atomIndex, normalizeAtomId(flatRow.id));
            for (const column of columns) {
                appendPropertyValue(appender, column, flatRow[column.name]);
            }
            appender.endRow();
            atomIndex += 1;
        }
        return;
    }

    const rowCount = getColumnarRowCount(rows);
    for (let atomIndex = 0; atomIndex < rowCount; atomIndex += 1) {
        appendRowHeader(
            appender,
            timestep,
            atomIndex,
            normalizeAtomId(rows.id?.[atomIndex] as AtomId | undefined)
        );
        for (const column of columns) {
            appendPropertyValue(appender, column, readColumnarValue(rows, atomIndex, column));
        }
        appender.endRow();
    }
};
