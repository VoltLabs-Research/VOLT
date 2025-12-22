import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import DocumentListing, { type ColumnConfig } from '@/components/organisms/common/DocumentListing';
import trajectoryApi from '@/services/api/trajectory';

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
    const { trajectoryId, analysisId, exposureId } = useParams();
    const [searchParams] = useSearchParams();
    const timestep = Number(searchParams.get('timestep') || '0');

    const [rows, setRows] = useState<MergedAtomsRow[]>([]);
    const [properties, setProperties] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const pageSize = 50_000;

    const fetchPage = useCallback(async(nextPage: number) => {
        if(!trajectoryId || !analysisId || !exposureId){
            setError('Missing required parameters.');
            return;
        }

        setError(null);
        if(nextPage === 1){
            setLoading(true);
        }else{
            setIsFetchingMore(true);
        }

        try{
            const result = await trajectoryApi.getAtoms(
                trajectoryId,
                analysisId,
                { timestep, exposureId, page: nextPage, pageSize }
            );

            if(!result){
                setError('Failed to load atoms data.');
                return;
            }

            setProperties(result.properties);
            setTotal(result.total);
            setHasMore(result.hasMore);
            setPage(nextPage);

            if(nextPage === 1){
                setRows(result.data);
            }else{
                setRows(prev => [...prev, ...result.data]);
            }
        }catch(err: any){
            const message = err?.response?.data?.message || err?.message || 'Failed to load atoms.';
            setError(message);
        }finally{
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, [trajectoryId, analysisId, exposureId, timestep, pageSize]);

    useEffect(() => {
        setRows([]);
        setPage(1);
        setHasMore(false);
        fetchPage(1);
    }, [fetchPage]);

    const typePalette = useMemo(() => [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2',
        '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff9896',
        '#c5b0d5', '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
    ], []);

    const typeToColor = (t?: number): string => {
        if(t === undefined || t === null) return '#888888';
        const type = Math.max(1, Math.floor(t as number));
        if(type <= typePalette.length) return typePalette[type - 1];
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
        for(const prop of uniqueProperties){
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
            enableInfinite
            hasMore={hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={() => {
                if(!loading && !isFetchingMore && hasMore){
                    fetchPage(page + 1);
                }
            }}
        />
    );
};

export default PerAtomViewer;
