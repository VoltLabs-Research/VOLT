import { useMemo } from 'react';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import PluginCompactTable, { type ColumnConfig } from '@/modules/plugin/components/listing/PluginCompactTable';
import { useTrajectoryAtomsInfiniteQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { atomsToAoS } from '@/modules/trajectory/utilities/decode-atoms-binary';

import type { AtomData } from '@/modules/trajectory/api/dtos/trajectory';
import formatAtomValue from '@/modules/trajectory/shared/format-atom-value';

interface PluginAtomsTableProps {
    trajectoryId: string;
    analysisId?: string;
    exposureId?: string;
    onDataReady?: (columns: ColumnConfig[], data: Record<string, unknown>[]) => void;
}

const TYPE_PALETTE = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2',
    '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff9896',
    '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];

const getTypeColor = (t?: number): string => {
    if (t === undefined || t === null) return '#888888';
    const type = Math.max(1, Math.floor(t));
    if (type <= TYPE_PALETTE.length) return TYPE_PALETTE[type - 1];
    const hue = ((type - 1) * 47) % 360;
    return `hsl(${hue}deg 60% 55%)`;
};

const ATOMS_PAGE_SIZE = 100;

const BASE_ATOM_COLUMN_KEYS = new Set(['id', 'type', 'x', 'y', 'z']);

const PluginAtomsTable = ({ trajectoryId, analysisId, exposureId, onDataReady }: PluginAtomsTableProps) => {
    const currentTimestep = useEditorStore((state) => state.currentTimestep);

    const resolvedAnalysisId = analysisId || 'default';
    const enabled = Boolean(trajectoryId && currentTimestep !== undefined);
    const baseAtomsParams = useMemo(() => ({
        trajectoryId,
        analysisId: resolvedAnalysisId,
        exposureId,
        timestep: currentTimestep ?? 0,
        limit: ATOMS_PAGE_SIZE
    }), [trajectoryId, resolvedAnalysisId, exposureId, currentTimestep]);

    const {
        data: infiniteData,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        error
    } = useTrajectoryAtomsInfiniteQuery(baseAtomsParams, { enabled });

    const rows: AtomData[] = useMemo(() => {
        if (!infiniteData?.pages) return [];
        return infiniteData.pages.flatMap((page) => atomsToAoS(page));
    }, [infiniteData]);

    const properties: string[] = useMemo(() => {
        if (!infiniteData?.pages?.length) return [];
        for (let i = infiniteData.pages.length - 1; i >= 0; i--) {
            const props = infiniteData.pages[i].propertyNames;
            if (props?.length) return props;
        }
        return [];
    }, [infiniteData]);

    const columns: ColumnConfig[] = useMemo(() => {
        const base: ColumnConfig[] = [
            { key: 'id', title: 'ID', width: 80 },
            {
                key: 'type',
                title: 'Type',
                width: 80,
                render: (v: unknown) => {
                    const numericValue = typeof v === 'number' ? v : undefined;
                    return (
                        <div className='d-flex items-center gap-05'>
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: getTypeColor(numericValue)
                                }}
                            />
                            {String(v)}
                        </div>
                    );
                }
            },
            { key: 'x', title: 'X', width: 100, render: (value: unknown) => formatAtomValue(value, 3) },
            { key: 'y', title: 'Y', width: 100, render: (value: unknown) => formatAtomValue(value, 3) },
            { key: 'z', title: 'Z', width: 100, render: (value: unknown) => formatAtomValue(value, 3) }
        ];

        const extra = properties
            .filter((prop) => !BASE_ATOM_COLUMN_KEYS.has(prop))
            .map((prop) => ({
                key: prop,
                title: prop,
                width: 120,
                render: (value: unknown) => formatAtomValue(value, 4)
            }));

        return [...base, ...extra];
    }, [properties]);

    const handleLoadMore = () => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    };

    return (
        <PluginCompactTable
            columns={columns}
            data={rows}
            hasMore={hasNextPage ?? false}
            isLoading={isLoading}
            isFetchingMore={isFetchingNextPage}
            onLoadMore={handleLoadMore}
            error={error}
            onDataReady={onDataReady}
        />
    );
};

export default PluginAtomsTable;
