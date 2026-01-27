/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import PluginCompactTable, { type ColumnConfig } from '@/modules/plugins/presentation/components/organisms/PluginCompactTable';
import { useAtoms } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';

interface PluginAtomsTableProps {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    onDataReady?: (columns: ColumnConfig[], data: any[]) => void;
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

const PluginAtomsTable = ({
    trajectoryId,
    analysisId,
    exposureId,
    onDataReady,
}: PluginAtomsTableProps) => {
    const currentTimestep = useEditorStore((state) => state.currentTimestep);

    const {
        rows,
        properties,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        error: fetchError
    } = useAtoms({
        trajectoryId,
        analysisId,
        timestep: currentTimestep!,
        exposureId,
        pageSize: 50000
    });

    const error = fetchError ? (fetchError as any).message || 'Failed to fetch atoms' : null;



    const columns: ColumnConfig[] = useMemo(() => {
        const base = [
            { key: 'id', title: 'ID', width: 80 },
            {
                key: 'type',
                title: 'Type',
                width: 80,
                render: (v: number) => (
                    <div className="d-flex items-center gap-05">
                        <div
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: getTypeColor(v)
                            }}
                        />
                        {v}
                    </div>
                )
            },
            { key: 'x', title: 'X', width: 100, render: (v: number) => typeof v === 'number' ? v.toFixed(3) : v },
            { key: 'y', title: 'Y', width: 100, render: (v: number) => typeof v === 'number' ? v.toFixed(3) : v },
            { key: 'z', title: 'Z', width: 100, render: (v: number) => typeof v === 'number' ? v.toFixed(3) : v },
        ];

        const extra = properties.map(prop => ({
            key: prop,
            title: prop,
            width: 120,
            render: (v: any) => typeof v === 'number' ? v.toFixed(4) : String(v ?? '-')
        }));

        return [...base, ...extra];
    }, [properties]);

    useEffect(() => {
        if (onDataReady) {
            onDataReady(columns, rows);
        }
    }, [columns, rows, onDataReady]);

    return (
        <PluginCompactTable
            columns={columns}
            data={rows}
            hasMore={hasNextPage}
            isLoading={isLoading}
            isFetchingMore={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            error={error}
            onDataReady={onDataReady}
        />
    );
};

export default PluginAtomsTable;
