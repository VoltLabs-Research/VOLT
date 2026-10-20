import type { DuckDBConnection } from '@duckdb/node-api';
import {
    quoteIdentifier,
    sqlString
} from '@modules/plugin/services/properties/duckdb-sql-escaping';
import { BASE_COLUMNS } from '@modules/plugin/services/properties/parquet-property-schema';


const NON_PROPERTY_COLUMNS = new Set(['atom_index', 'x', 'y', 'z', 'bucket']);

const isCosmeticColorColumn = (name: string): boolean =>
    name === 'color' || name.endsWith('_color');

const NUMERIC_TYPE_PATTERN = /^(BOOLEAN|[US]?TINYINT|[US]?SMALLINT|[US]?INTEGER|[US]?BIGINT|HUGEINT|UHUGEINT|FLOAT|REAL|DOUBLE|DECIMAL|NUMERIC)/;

interface SourceColumn {
    name: string;
    type: string;
}

interface ProjectedColumn {
    name: string;
    expression: string;
    isNumeric: boolean;
}

interface PropertyProjection {
    columnNames: string[];
    rowCount: number;
    copyTo: (outputPath: string) => Promise<void>;
}

const describeSource = async (
    connection: DuckDBConnection,
    filePath: string
): Promise<SourceColumn[]> => {
    const reader = await connection.runAndReadAll(
        `DESCRIBE SELECT * FROM read_parquet(${sqlString(filePath)})`
    );

    return reader.getRowObjectsJS().map((row) => ({
        name: String(row.column_name ?? ''),
        type: String(row.column_type ?? '').toUpperCase()
    })).filter((column) => column.name.length > 0);
};

const isListType = (type: string): boolean => type.endsWith('[]') || type.startsWith('LIST');

const listElementType = (type: string): string =>
    type.endsWith('[]') ? type.slice(0, -2) : type;

const readAggregateRow = async (
    connection: DuckDBConnection,
    filePath: string,
    projections: string[]
): Promise<Record<string, unknown> | undefined> => {
    const reader = await connection.runAndReadAll(
        `SELECT ${projections.join(', ')} FROM read_parquet(${sqlString(filePath)})`
    );
    return reader.getRowObjectsJS()[0];
};

const measureListLengths = async (
    connection: DuckDBConnection,
    filePath: string,
    listColumns: SourceColumn[]
): Promise<Map<string, number>> => {
    const lengths = new Map<string, number>();
    if (listColumns.length === 0) {
        return lengths;
    }

    const projections = listColumns
        .map((column, index) => `MAX(LEN(${quoteIdentifier(column.name)})) AS len_${index}`);
    const row = await readAggregateRow(connection, filePath, projections);

    for (let index = 0; index < listColumns.length; index += 1) {
        const value = Number(row?.[`len_${index}`] ?? 0);
        lengths.set(listColumns[index].name, Number.isFinite(value) ? value : 0);
    }

    return lengths;
};

const resolveTextColumnNumeracy = async (
    connection: DuckDBConnection,
    filePath: string,
    expressions: Array<{ key: string; expression: string }>
): Promise<Set<string>> => {
    const numericKeys = new Set<string>();
    if (expressions.length === 0) {
        return numericKeys;
    }

    const projections = expressions
        .map(({ expression }, index) =>
            `COUNT(*) FILTER (WHERE (${expression}) IS NOT NULL `
            + `AND TRY_CAST((${expression}) AS DOUBLE) IS NULL) AS bad_${index}`);
    const row = await readAggregateRow(connection, filePath, projections);

    for (let index = 0; index < expressions.length; index += 1) {
        if (Number(row?.[`bad_${index}`] ?? 0) === 0) {
            numericKeys.add(expressions[index].key);
        }
    }

    return numericKeys;
};

const countRows = async (connection: DuckDBConnection, filePath: string): Promise<number> => {
    const row = await readAggregateRow(connection, filePath, ['COUNT(*) AS total']);
    return Number(row?.total ?? 0);
};

export const buildPropertyProjection = async (
    connection: DuckDBConnection,
    filePath: string,
    timestep: number
): Promise<PropertyProjection | null> => {
    const sourceColumns = await describeSource(connection, filePath);
    const candidates = sourceColumns.filter((column) =>
        !NON_PROPERTY_COLUMNS.has(column.name)
        && !BASE_COLUMNS.has(column.name)
        && !isCosmeticColorColumn(column.name));

    const listLengths = await measureListLengths(
        connection,
        filePath,
        candidates.filter((column) => isListType(column.type))
    );

    const projected: ProjectedColumn[] = [];
    const ambiguous: Array<{ key: string; expression: string }> = [];

    for (const column of candidates) {
        const quoted = quoteIdentifier(column.name);

        if (isListType(column.type)) {
            const length = listLengths.get(column.name) ?? 0;
            const elementIsNumeric = NUMERIC_TYPE_PATTERN.test(listElementType(column.type));
            for (let index = 0; index < length; index += 1) {
                const expression = `${quoted}[${index + 1}]`;
                const name = `${column.name}[${index}]`;
                projected.push({
                    name,
                    expression,
                    isNumeric: elementIsNumeric
                });
                if (!elementIsNumeric) {
                    ambiguous.push({
                        key: name,
                        expression
                    });
                }
            }
            continue;
        }

        const isNumeric = NUMERIC_TYPE_PATTERN.test(column.type);
        projected.push({
            name: column.name,
            expression: quoted,
            isNumeric
        });
        if (!isNumeric) {
            ambiguous.push({
                key: column.name,
                expression: quoted
            });
        }
    }

    if (projected.length === 0) {
        return null;
    }

    const numericTextColumns = await resolveTextColumnNumeracy(connection, filePath, ambiguous);
    projected.sort((left, right) => left.name.localeCompare(right.name));

    const hasSourceId = sourceColumns.some((column) => column.name === 'id');
    const hasSourceAtomIndex = sourceColumns.some((column) => column.name === 'atom_index');
    const rowNumberWindow = hasSourceAtomIndex
        ? `ROW_NUMBER() OVER (ORDER BY ${quoteIdentifier('atom_index')})`
        : 'ROW_NUMBER() OVER ()';

    const selectList = [
        `CAST(${timestep} AS BIGINT) AS timestep`,
        `CAST(${rowNumberWindow} - 1 AS UINTEGER) AS atom_index`,
        hasSourceId
            ? `TRY_CAST(${quoteIdentifier('id')} AS UBIGINT) AS id`
            : 'CAST(NULL AS UBIGINT) AS id',
        ...projected.map((column) => {
            const asDouble = column.isNumeric || numericTextColumns.has(column.name);
            const cast = asDouble
                ? `TRY_CAST(${column.expression} AS DOUBLE)`
                : `CAST(${column.expression} AS VARCHAR)`;
            return `${cast} AS ${quoteIdentifier(column.name)}`;
        })
    ].join(', ');

    const rowCount = await countRows(connection, filePath);

    return {
        columnNames: projected.map((column) => column.name),
        rowCount,
        copyTo: async (outputPath: string): Promise<void> => {
            await connection.run(
                `COPY (SELECT ${selectList} FROM read_parquet(${sqlString(filePath)}) ORDER BY 2) `
                + `TO ${sqlString(outputPath)} (FORMAT PARQUET, COMPRESSION ZSTD)`
            );
        }
    };
};
