import { useSubListingInfiniteQuery } from '@/modules/plugin/hooks/listing/queries';
import { formatPanelValue, resolveSwatchColor } from './panel-formatting';

import type { IPanelTable } from '@volt/contracts/modules/plugin/exposure';

interface PanelResultsTableProps {
    table: IPanelTable;
    analysisId: string;
    exposureId: string;
    timestep: number;
}

// A results table summarises categories, so it is inherently short. One page is the
// whole table; anything longer is a listing, not a summary, and belongs in the results
// viewer where it can be paged and downloaded.
const MAX_PANEL_ROWS = 64;

const PanelResultsTable = ({ table, analysisId, exposureId, timestep }: PanelResultsTableProps) => {
    const query = useSubListingInfiniteQuery(
        {
            analysisId,
            exposureId,
            timestep,
            subListingName: table.source,
            limit: MAX_PANEL_ROWS
        },
        {
            getNextPageParam: () => undefined,
            enabled: Boolean(analysisId && exposureId)
        }
    );

    const rows = query.data?.pages.flatMap((page) => page.rows) ?? [];

    return (
        <div className='flex flex-col gap-1 px-2.5 pb-2'>
            <span className='text-2xs font-medium text-muted'>{table.title}</span>

            {query.isLoading && (
                <span className='text-2xs text-muted'>Loading…</span>
            )}

            {!query.isLoading && rows.length === 0 && (
                <span className='text-2xs text-muted'>No results for this frame.</span>
            )}

            {rows.length > 0 && (
                <table className='w-full border-collapse text-2xs'>
                    <thead>
                        <tr className='text-muted'>
                            {/* Swatch column: no header, it labels itself. */}
                            <th className='w-4 p-0' aria-label='Color' />
                            {/* No header: the swatch and the name label themselves. */}
                            <th className='w-full py-0.5 pl-2 text-left font-normal' />
                            {table.columns.map((column) => (
                                <th
                                    key={column.column}
                                    className='py-0.5 pl-3 text-right font-normal whitespace-nowrap'
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => {
                            const label = String(row[table.label] ?? '—');
                            const swatch = resolveSwatchColor(table, row);

                            return (
                                <tr key={`${label}-${index}`} className='text-foreground'>
                                    <td className='p-0 align-middle'>
                                        <span
                                            className='block size-2.5 rounded-sm'
                                            style={swatch
                                                ? { backgroundColor: swatch }
                                                : { border: '1px solid var(--border)' }}
                                            title={swatch ? undefined : 'The plugin declared no color for this category'}
                                        />
                                    </td>
                                    {/*
                                      * `w-full` makes this the column that absorbs the row's
                                      * spare width, so a short category name is written in
                                      * full; it was `max-w-0`, which shrinks the cell to its
                                      * minimum and clipped "OTHER" to "O…" with 180px free.
                                      */}
                                    <td className='w-full truncate py-0.5 pl-2' title={label}>{label}</td>
                                    {table.columns.map((column) => (
                                        <td
                                            key={column.column}
                                            className='py-0.5 pl-3 text-right tabular-nums whitespace-nowrap'
                                        >
                                            {formatPanelValue(row[column.column], column.format)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default PanelResultsTable;
