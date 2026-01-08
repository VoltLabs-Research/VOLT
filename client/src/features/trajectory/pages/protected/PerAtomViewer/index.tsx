import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePageTitle } from '@/hooks/core/use-page-title';
import { useParams, useSearchParams } from 'react-router-dom';
import DocumentListing, { type ColumnConfig } from '@/components/organisms/common/DocumentListing';
import trajectoryApi from '@/features/trajectory/api/trajectory';
import useListingLifecycle, { type ListingMeta } from '@/hooks/common/use-listing-lifecycle';

interface MergedAtomsRow {
    idx: number;
    id: number;
    type?: number;
    x: number;
    y: number;
    z: number;
    [key: string]: any;
}

const PerAtomViewer = () => {
    usePageTitle('Per Atom Viewer');
    const { trajectoryId, analysisId, exposureId } = useParams();

    const [searchParams] = useSearchParams();
    const timestep = Number(searchParams.get('timestep') || '0');

    const [rows, setRows] = useState<MergedAtomsRow[]>([]);
    const [properties, setProperties] = useState<string[]>([]);
    const [listingMeta, setListingMeta] = useState<ListingMeta>({
        page: 1,
        limit: 100,
        hasMore: false,
        total: 0
    });
    const [loading, setLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pageSize = 100;

    const fetchPage = useCallback(async (params: any) => {
        const { page: nextPage, force } = params;

        if (!trajectoryId || !analysisId || !exposureId) {
            setError('Missing required parameters.');
            return;
        }

        setError(null);
        if (nextPage === 1 || force) {
            setLoading(true);
        } else {
            setIsFetchingMore(true);
        }

        try {
            const result = await trajectoryApi.getAtoms(
                trajectoryId,
                analysisId,
                { timestep, exposureId, page: nextPage, pageSize }
            );

            if (!result) {
                setError('Failed to load atoms data.');
                return;
            }

            setProperties(result.properties);

            setListingMeta(prev => ({
                ...prev,
                page: nextPage,
                hasMore: result.hasMore,
                total: result.total
            }));

            if (nextPage === 1) {
                setRows(result.data);
            } else {
                setRows(prev => [...prev, ...result.data]);
            }
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Failed to load atoms.';
            setError(message);
        } finally {
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [trajectoryId, analysisId, exposureId, timestep, pageSize]);

    const { handleLoadMore } = useListingLifecycle({
        data: rows,
        isLoading: loading,
        isFetchingMore,
        listingMeta,
        fetchData: fetchPage,
        initialFetchParams: { page: 1, limit: pageSize },
        dependencies: [trajectoryId, analysisId, exposureId, timestep, pageSize]
    });



    const typePalette = useMemo(() => [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2',
        '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff9896',
        '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
    ], []);

    const typeToColor = (t?: number): string => {
        if (t === undefined || t === null) return '#888888';
        const type = Math.max(1, Math.floor(t as number));
        if (type <= typePalette.length) return typePalette[type - 1];
        const hue = ((type - 1) * 47) % 360;
        return `hsl(${hue}deg 60% 55%)`;
    };

    const columns: ColumnConfig[] = useMemo(() => {
        const baseCols: ColumnConfig[] = [
            { key: 'id', title: 'ID', skeleton: { variant: 'text', width: 60 } },
            {
                key: 'type',
                title: 'Type',
                skeleton: { variant: 'text', width: 60 },
                render: (v: number) => (
                    <span className='d-flex items-center gap-0-5'>
                        <span
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: typeToColor(v),
                                display: 'inline-block'
                            }}
                        />
                        {v ?? ''}
                    </span>
                )
            },
            { key: 'x', title: 'X', skeleton: { variant: 'text', width: 80 }, render: (v: number) => v?.toFixed?.(3) ?? String(v) },
            { key: 'y', title: 'Y', skeleton: { variant: 'text', width: 80 }, render: (v: number) => v?.toFixed?.(3) ?? String(v) },
            { key: 'z', title: 'Z', skeleton: { variant: 'text', width: 80 }, render: (v: number) => v?.toFixed?.(3) ?? String(v) },
        ];

        // Add per-atom property columns(deduplicated)
        const uniqueProperties = [...new Set(properties)];
        for (const prop of uniqueProperties) {
            baseCols.push({
                key: prop,
                title: prop,
                skeleton: { variant: 'text', width: 80 },
                render: (v: number) => typeof v === 'number' ? v.toFixed(20) : String(v ?? '-')
            });
        }

        return baseCols;
    }, [properties, typePalette]);

    const title = `Per-Atom Properties - Frame ${timestep}`;

    return (
        <DocumentListing
            title={title}
            columns={columns}
            data={rows}
            isLoading={loading}
            emptyMessage={error ?? 'No atoms data found.'}
            hasMore={listingMeta.hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={handleLoadMore}
        />
    );
};

export default PerAtomViewer;
