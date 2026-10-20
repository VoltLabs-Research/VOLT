import formatSnakeCaseToTitle from '@/modules/plugin/utils/listing/format-snake-case';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';

export const normalizeListingColumns = (
    columns: ColumnConfig[] | undefined,
    showTrajectoryColumn: boolean
): ColumnConfig[] => {
    if(!columns?.length) return [];

    const normalized = columns.map((column) => {
        const key = column.key || column.label || '';
        return {
            key,
            title: column.title || (column.label ? formatSnakeCaseToTitle(column.label) : key),
            sortable: Boolean(column.sortable)
        };
    });

    if(showTrajectoryColumn) return normalized;

    return normalized.filter((column) => column.key !== 'trajectoryName');
};
