import CompositionBar from '@/modules/analysis/components/charts/CompositionBar';
import { toCompositionParts } from '@/modules/analysis/utils/panel-composition';
import { formatPanelValue } from '@/modules/canvas/components/AnalysisResultsSection/panel-formatting';
import { useSubListingInfiniteQuery } from '@/modules/plugin/hooks/listing/queries';
import { Skeleton } from '@heroui/react';
import { useMemo, useRef } from 'react';
import type { RunPanelTable } from '@/modules/analysis/utils/run-results';

interface PanelTileProps {
    analysisId: string;
    panel: RunPanelTable;
    timestep: number | undefined;
    failed: boolean;
    rowSpan: number;
}

const MAX_PANEL_ROWS = 64;

/* A panel table the plugin declares, at the current frame: its capsule, then one row per category. */
const PanelTile = ({ analysisId, panel, timestep, failed, rowSpan }: PanelTileProps) => {
    const { table } = panel;
    const query = useSubListingInfiniteQuery(
        {
            analysisId,
            exposureId: panel.exposureId,
            timestep: timestep ?? 0,
            subListingName: table.source,
            limit: MAX_PANEL_ROWS
        },
        {
            getNextPageParam: () => undefined,
            enabled: timestep !== undefined && !failed
        }
    );

    // Keep the last frame's rows while the next one loads, so playback does not flash empty tiles.
    const lastRowsRef = useRef<Record<string, unknown>[]>([]);
    const fetched = query.data?.pages.flatMap((page) => page.rows);
    if (fetched) lastRowsRef.current = fetched;
    const rows = fetched ?? lastRowsRef.current;
    const parts = useMemo(() => toCompositionParts(table, rows), [table, rows]);

    let body: React.ReactNode;
    if (failed) {
        body = <span className='text-xs text-danger'>Frame failed</span>;
    } else if (query.isLoading && rows.length === 0) {
        body = <Skeleton className='h-24 w-full rounded-lg' />;
    } else if (rows.length === 0) {
        body = <span className='text-xs text-muted'>No rows at this frame</span>;
    } else {
        body = (
            <>
                <CompositionBar parts={parts} height={10} />
                <div className='mt-2.5'>
                    {rows.map((row, index) => (
                        <div key={parts[index]?.key ?? index} className='flex min-h-9 items-center gap-3 border-t border-border text-sm first:border-t-0'>
                            <span className='flex min-w-0 flex-1 items-center gap-2.5'>
                                <span className='size-[9px] shrink-0 rounded-full' style={{ background: parts[index]?.color }} />
                                <span className='truncate'>{String(row[table.label] ?? '—')}</span>
                            </span>
                            {table.columns.map((column, position) => (
                                <span
                                    key={column.column}
                                    className={position === table.columns.length - 1 ? 'min-w-16 text-right tabular-nums text-foreground' : 'tabular-nums text-muted'}
                                >
                                    {formatPanelValue(row[column.column], column.format)}
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </>
        );
    }

    return (
        <div className='flex min-w-0 flex-col gap-3 rounded-2xl border border-border px-4 pb-4 pt-4' style={{ gridColumn: 'span 6', gridRow: `span ${rowSpan}` }}>
            <span className='text-xs font-medium text-muted'>{table.title || table.source}</span>
            <div>{body}</div>
        </div>
    );
};

export default PanelTile;
