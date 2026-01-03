/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import trajectoryApi from '@/services/api/trajectory/trajectory';
import { useEditorStore } from '@/stores/slices/editor';
import PluginCompactTable, { type ColumnConfig } from '../PluginCompactTable';
import useListingLifecycle, { type ListingMeta } from '@/hooks/common/use-listing-lifecycle';

interface PluginAtomsTableProps {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
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
}: PluginAtomsTableProps) => {
    const currentTimestep = useEditorStore((state) => state.currentTimestep);


    const [rows, setRows] = useState<any[]>([]);
    const [properties, setProperties] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [listingMeta, setListingMeta] = useState<ListingMeta>({
        page: 1,
        limit: 50000,
        hasMore: false
    });
    const [error, setError] = useState<string | null>(null);

    const fetchAtoms = useCallback(async (params: any) => {
        if (!trajectoryId || !analysisId || currentTimestep === undefined) return;

        const { page: pageNum, force } = params;

        if (pageNum === 1 || force) setIsLoading(true);
        else setIsFetchingMore(true);

        setError(null);

        try {
            const response = await trajectoryApi.getAtoms(trajectoryId, analysisId, {
                timestep: currentTimestep,
                exposureId,
                page: pageNum,
                pageSize: 50000
            });

            if (response) {
                setRows((prev) => (pageNum === 1 ? response.data : [...prev, ...response.data]));
                setProperties(response.properties);
                setListingMeta(prev => ({
                    ...prev,
                    page: pageNum,
                    hasMore: response.hasMore,
                    // Assuming response doesn't provide total, or if it does:
                    total: response.total
                }));
            } else {
                if (pageNum === 1) setRows([]);
                setListingMeta(prev => ({ ...prev, hasMore: false }));
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch atoms');
        } finally {
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [trajectoryId, analysisId, exposureId, currentTimestep]);

    const { handleLoadMore } = useListingLifecycle({
        data: rows,
        isLoading,
        isFetchingMore,
        listingMeta,
        fetchData: fetchAtoms,
        initialFetchParams: { page: 1, limit: 50000 },
        dependencies: [trajectoryId, analysisId, exposureId, currentTimestep]
    });



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

    return (
        <PluginCompactTable
            columns={columns}
            data={rows}
            hasMore={listingMeta.hasMore}
            isLoading={isLoading}
            isFetchingMore={isFetchingMore}
            onLoadMore={handleLoadMore}
            error={error}
        />
    );
};

export default PluginAtomsTable;
