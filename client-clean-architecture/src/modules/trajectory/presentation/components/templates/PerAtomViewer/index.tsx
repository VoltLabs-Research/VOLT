import { useCallback, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import useTrajectoryUseCases from '../../../hooks/trajectory/use-trajectory-use-cases';
import useListingLifecycle from '@/shared/presentation/hooks/use-listing-lifecycle';
import type { ListingMeta } from '@/shared/domain/entities/ListingMeta';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import Container from '@/shared/presentation/components/Container';

interface AtomRow {
    id: number;
    type?: number;
    x: number;
    y: number;
    z: number;
    [key: string]: unknown;
};

const TYPE_PALETTE = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2',
    '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff9896',
    '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];

const typeToColor = (t?: number): string => {
    if(t === undefined || t === null) return '#888888';
    const type = Math.max(1, Math.floor(t as number));
    if(type <= TYPE_PALETTE.length) return TYPE_PALETTE[type - 1];
    const hue = ((type - 1) * 47) % 360;
    return `hsl(${hue}deg 60% 55%)`;
};

const PerAtomViewer = () => {
    const { trajectoryId, analysisId, exposureId } = useParams();
    const [searchParams] = useSearchParams();
    const timestep = Number(searchParams.get('timestep') || '0');
    const pageSize = 100;

    const { getAtomsUseCase } = useTrajectoryUseCases();

    const [rows, setRows] = useState<AtomRow[]>([]);
    const [properties, setProperties] = useState<string[]>([]);
    const [listingMeta, setListingMeta] = useState<ListingMeta>({
        page: 1,
        limit: pageSize,
        hasMore: false,
        total: 0
    });
    const [loading, setLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPage = useCallback(async (params: { page?: number; force?: boolean }) => {
        const { page: nextPage = 1, force } = params;

        if(!trajectoryId){
            setError('Missing trajectory ID.');
            return;
        }

        const effectiveAnalysisId = analysisId === 'default' ? undefined : analysisId;
        const effectiveExposureId = exposureId === 'default' ? undefined : exposureId;

        setError(null);
        if(nextPage === 1 || force){
            setLoading(true);
        }else{
            setIsFetchingMore(true);
        }

        try{
            const result = await getAtomsUseCase.execute({
                trajectoryId,
                analysisId: effectiveAnalysisId || 'default',
                timestep,
                exposureId: effectiveExposureId,
                page: nextPage,
                limit: pageSize
            });

            if(!result){
                setError('Failed to load atoms data.');
                return;
            }

            setProperties(result.columns || []);

            setListingMeta((prev) => ({
                ...prev,
                page: nextPage,
                hasMore: nextPage * pageSize < result.total,
                total: result.total
            }));

            if(nextPage === 1){
                setRows(result.atoms as unknown as AtomRow[]);
            }else{
                setRows((prev) => [...prev, ...(result.atoms as unknown as AtomRow[])]);
            }
        }catch(err: unknown){
            const message = err instanceof Error ? err.message : 'Failed to load atoms.';
            setError(message);
        }finally{
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [trajectoryId, analysisId, exposureId, timestep, pageSize, getAtomsUseCase]);

    const { handleLoadMore } = useListingLifecycle({
        data: rows,
        isLoading: loading,
        isFetchingMore,
        listingMeta,
        fetchData: fetchPage,
        initialFetchParams: { page: 1, limit: pageSize },
        dependencies: [trajectoryId, analysisId, exposureId, timestep]
    });

    const columns: ColumnConfig[] = useMemo(() => {
        const baseCols: ColumnConfig[] = [
            { key: 'id', title: 'ID', skeleton: { variant: 'text', width: 60 } },
            {
                key: 'type',
                title: 'Type',
                skeleton: { variant: 'text', width: 60 },
                render: (v) => (
                    <Container className='d-flex items-center gap-05'>
                        <span
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: typeToColor(v as number),
                                display: 'inline-block'
                            }}
                        />
                        {String(v ?? '')}
                    </Container>
                )
            },
            { key: 'x', title: 'X', skeleton: { variant: 'text', width: 80 }, render: (v) => (v as number)?.toFixed?.(3) ?? String(v) },
            { key: 'y', title: 'Y', skeleton: { variant: 'text', width: 80 }, render: (v) => (v as number)?.toFixed?.(3) ?? String(v) },
            { key: 'z', title: 'Z', skeleton: { variant: 'text', width: 80 }, render: (v) => (v as number)?.toFixed?.(3) ?? String(v) }
        ];

        const uniqueProperties = [...new Set(properties)];
        for(const prop of uniqueProperties){
            baseCols.push({
                key: prop,
                title: prop,
                skeleton: { variant: 'text', width: 80 },
                render: (v) => typeof v === 'number' ? v.toFixed(6) : String(v ?? '-')
            });
        }

        return baseCols;
    }, [properties]);

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
