import { useMemo } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';
import formatSnakeCaseToTitle from '@/modules/plugin/utils/listing/format-snake-case';
import { useWasmAnalysisFrames } from './use-wasm-canvas';

interface WasmListingTableProps {
    analysisId?: string;
    exposureId: string;
    currentTimestep?: number;
}

const MAX_SUB_LISTING_ROWS = 200;

const formatCell = (value: unknown): string => {
    if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : value.toPrecision(6).replace(/\.?0+$/, '');
    }
    if (value === null || value === undefined || value === '') return '—';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

const ResultTable = ({ title, rows, columns }: { title: string; rows: Record<string, unknown>[]; columns: string[] }) => (
    <div className='flex flex-col gap-1'>
        <span className='text-2xs font-medium text-muted'>
            {title}
            {rows.length > MAX_SUB_LISTING_ROWS ? ` (first ${MAX_SUB_LISTING_ROWS} of ${rows.length})` : ''}
        </span>
        <table className='w-full border-collapse text-2xs'>
            <thead>
                <tr className='text-muted'>
                    {columns.map((column) => (
                        <th key={column} className='py-0.5 pr-4 text-left font-normal whitespace-nowrap'>
                            {formatSnakeCaseToTitle(column)}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.slice(0, MAX_SUB_LISTING_ROWS).map((row, index) => (
                    <tr key={index} className='text-foreground'>
                        {columns.map((column) => (
                            <td key={column} className='py-0.5 pr-4 tabular-nums whitespace-nowrap'>
                                {formatCell(row[column])}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const columnsOf = (rows: Record<string, unknown>[]): string[] => Array.from(new Set(rows.flatMap(Object.keys)));

// Listing tab for /canvas/wasm: one row per analyzed frame plus the current frame's sub-listings.
const WasmListingTable = ({ analysisId, exposureId, currentTimestep }: WasmListingTableProps) => {
    const frames = useWasmAnalysisFrames(analysisId);

    const frameRows = useMemo(() => Object.entries(frames)
        .map(([timestep, frame]) => ({ timestep: Number(timestep), listing: frame.listings[exposureId] }))
        .filter((entry) => entry.listing)
        .sort((left, right) => left.timestep - right.timestep)
        .map(({ timestep, listing }) => ({ timestep, ...listing.row })), [exposureId, frames]);

    const subListings = currentTimestep === undefined
        ? {}
        : frames[currentTimestep]?.listings[exposureId]?.subListings ?? {};

    if (frameRows.length === 0) {
        return (
            <div className='flex h-full flex-row items-center justify-center p-4'>
                <p className='text-xs text-muted'>
                    {Object.keys(frames).length === 0
                        ? 'No results yet. Run the pipeline to fill this table.'
                        : 'This plugin output has no listing rows.'}
                </p>
            </div>
        );
    }

    return (
        <Scrollable className='h-full min-h-0 bg-surface'>
            <div className='flex flex-col gap-4 px-4 py-3'>
                <ResultTable title='Frames' rows={frameRows} columns={columnsOf(frameRows)} />
                {Object.entries(subListings).map(([name, rows]) => (
                    <ResultTable
                        key={name}
                        title={`${formatSnakeCaseToTitle(name)} · timestep ${currentTimestep}`}
                        rows={rows}
                        columns={columnsOf(rows.slice(0, MAX_SUB_LISTING_ROWS))}
                    />
                ))}
            </div>
        </Scrollable>
    );
};

export default WasmListingTable;
