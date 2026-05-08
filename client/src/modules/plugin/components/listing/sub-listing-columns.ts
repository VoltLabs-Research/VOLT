import formatSnakeCaseToTitle from '@/modules/plugin/utilities/listing/format-snake-case';
import { inferColumnType, type InferredCellKind, type InferredColumnType } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import { renderInferredCell } from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers';
import type { ColumnConfig as DocumentColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig as CompactColumnConfig } from '@/modules/plugin/components/listing/PluginCompactTable';
import type { SubListingColumn } from '@/modules/plugin/api/dtos/listing/get-sub-listing';

export interface SubListingColumnSnapshot<TRow extends Record<string, unknown>> {
    columns: DocumentColumnConfig<TRow>[];
    inferredTypes: Record<string, InferredColumnType>;
}

const COLUMN_SAMPLE_LIMIT = 30;

const MIN_WIDTH_BY_KIND: Record<InferredCellKind, number> = {
    empty: 80,
    boolean: 72,
    integer: 96,
    number: 120,
    string: 180,
    date: 180,
    vector: 240,
    numberArray: 180,
    points: 120,
    matrix: 140,
    object: 280,
    mixed: 200
};

const inferColumnFromRows = (
    rows: Record<string, unknown>[],
    key: string
): InferredColumnType => {
    return inferColumnType(rows.slice(0, COLUMN_SAMPLE_LIMIT).map((row) => row[key]));
};

const getColumnWidth = (inferred: InferredColumnType): number => {
    return MIN_WIDTH_BY_KIND[inferred.kind] ?? MIN_WIDTH_BY_KIND.mixed;
};

export const buildCompactSubListingColumns = (
    columns: SubListingColumn[],
    rows: Record<string, unknown>[]
): CompactColumnConfig[] => {
    return columns.map((column) => {
        const key = column.label;
        const inferred = inferColumnFromRows(rows, key);

        return {
            key,
            title: formatSnakeCaseToTitle(key),
            width: getColumnWidth(inferred),
            render: (value: unknown) => renderInferredCell(value, inferred)
        };
    });
};

export const buildDocumentSubListingColumnSnapshot = <TRow extends Record<string, unknown>>(
    columns: SubListingColumn[],
    rows: TRow[]
): SubListingColumnSnapshot<TRow> => {
    const inferredTypes: Record<string, InferredColumnType> = {};
    const mapped = columns.map<DocumentColumnConfig<TRow>>((column) => {
        const key = column.label;
        const inferred = inferColumnFromRows(rows, key);
        inferredTypes[key] = inferred;

        return {
            key,
            title: formatSnakeCaseToTitle(key),
            sortable: column.sortable,
            minWidth: getColumnWidth(inferred),
            render: (value: unknown) => renderInferredCell(value, inferred)
        };
    });

    return { columns: mapped, inferredTypes };
};
