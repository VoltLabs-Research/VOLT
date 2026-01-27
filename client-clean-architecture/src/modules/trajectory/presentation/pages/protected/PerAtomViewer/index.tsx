import { useMemo } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import { useParams, useSearchParams } from 'react-router-dom';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/organisms/common/DocumentListing';
import { useAtoms } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';

const PerAtomViewer = () => {
    usePageTitle('Per Atom Viewer');
    const { trajectoryId, analysisId, exposureId } = useParams();

    const [searchParams] = useSearchParams();
    const timestep = Number(searchParams.get('timestep') || '0');

    const pageSize = 1000; // Using a larger page size for atoms loading if needed, or keeping it consistent

    const { 
        rows, 
        properties, 
        isLoading, 
        isFetchingNextPage, 
        hasNextPage, 
        fetchNextPage, 
        error: queryError 
    } = useAtoms({
        trajectoryId: trajectoryId!,
        analysisId: analysisId!,
        exposureId: exposureId!,
        timestep,
        pageSize
    });

    const error = useMemo(() => {
        if (!queryError) return null;
        return (queryError as any)?.message || 'Failed to load atoms.';
    }, [queryError]);

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
            isLoading={isLoading}
            emptyMessage={error ?? 'No atoms data found.'}
            hasMore={hasNextPage}
            isFetchingMore={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
        />
    );
};

export default PerAtomViewer;
