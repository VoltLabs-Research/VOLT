import { useEffect, useMemo, useRef, useState } from 'react';
import DocumentListingTable from '@/components/molecules/common/DocumentListingTable';
import type { ColumnConfig } from '@/components/organisms/common/DocumentListing';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
// Reuse styles from FrameAtomsTable or create new ones
import '@/components/organisms/trajectory/FrameAtomsTable/FrameAtomsTable.css';
import Draggable from '@/components/atoms/common/Draggable';
import useFrameAtoms from '@/hooks/trajectory/use-frame-atoms';

export type PluginAtomsTableProps = {
    trajectoryId: string;
    analysisId: string;
    timestep: number;
    pageSize?: number;
    initialPage?: number;
    decimals?: number;
    onClose?: () => void;
    title?: string;
};

const PluginAtomsTable = ({
    trajectoryId,
    analysisId,
    timestep,
    pageSize = 1000,
    initialPage = 1,
    decimals = 3,
    onClose,
    title = 'Plugin Atom Properties'
}: PluginAtomsTableProps) => {
    const [page, setPage] = useState<number>(initialPage);
    const [accRows, setAccRows] = useState<any[]>([]);
    const [lastAppendedPage, setLastAppendedPage] = useState<number>(0);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setPage(initialPage);
        setAccRows([]);
        setLastAppendedPage(0);
    }, [trajectoryId, analysisId, timestep, pageSize, initialPage]);

    const { data, loading } = useFrameAtoms(trajectoryId, analysisId, timestep, { page, pageSize });

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
            { key: 'idx', title: 'Particle', skeleton: { variant: 'text', width: 60 } },
            {
                key: 'type',
                title: 'Type',
                skeleton: { variant: 'text', width: 60 },
                render: (v: number) => (
                    <span className='type-cell'>
                        <span className='type-color-swatch' style={{ backgroundColor: typeToColor(v) }} />
                        {v ?? ''}
                    </span>
                )
            },
            { key: 'x', title: 'X', skeleton: { variant: 'text', width: 80 }, render: (v: number) => v?.toFixed?.(decimals) ?? String(v) },
            { key: 'y', title: 'Y', skeleton: { variant: 'text', width: 80 }, render: (v: number) => v?.toFixed?.(decimals) ?? String(v) },
            { key: 'z', title: 'Z', skeleton: { variant: 'text', width: 80 }, render: (v: number) => v?.toFixed?.(decimals) ?? String(v) },
        ];

        // Add plugin columns
        if(data?.properties){
            data.properties.forEach(prop => {
                baseCols.push({
                    key: prop,
                    title: prop,
                    skeleton: { variant: 'text', width: 80 },
                    render: (v: number) => typeof v === 'number' ? v.toFixed(decimals) : String(v)
                });
            });
        }
        return baseCols;
    }, [decimals, typePalette, data?.properties]);

    useEffect(() => {
        if(!data?.data) return;
        const currPage = data.page ?? page;

        // Use data.data directly as it already contains merged rows
        const newRows = data.data;

        if(currPage <= 1 || lastAppendedPage === 0){
            setAccRows(newRows);
            setLastAppendedPage(currPage);
            return;
        }

        if(currPage > lastAppendedPage){
            setAccRows(prev => [...prev, ...newRows]);
            setLastAppendedPage(currPage);
        }
    }, [data, page, pageSize, lastAppendedPage]);

    const rows = accRows;
    const total = data?.total ?? data?.natoms ?? 0;
    const effectivePageSize = data?.pageSize ?? pageSize;
    // const hasMore = rows.length < total;
    // Or if rows length is exactly page size, likely more.
    const hasMore = (data?.data?.length ?? 0) === effectivePageSize && rows.length < total;

    const handleLoadMore = () => {
        if(hasMore && !loading){
            setPage((p) => p + 1);
        }
    };

    const isInitialLoading = loading && rows.length === 0;

    if(isMinimized) return null;

    return (
        <Draggable
            enabled
            bounds='viewport'
            axis='both'
            doubleClickToDrag={true}
            handle='.frame-atoms-table-header-title'
            scaleWhileDragging={0.95}
            className='frame-atoms-table-draggable'
            resizable={true}
            minWidth={600}
            minHeight={400}
        >
            <Container className={`frame-atoms-table-container primary-surface ${isMaximized ? 'maximized' : ''}`}>
                <Container className='d-flex gap-1-5 column p-1 u-select-none'>
                    <WindowIcons
                        onClose={onClose}
                        onExpand={() => setIsMaximized(!isMaximized)}
                        onMinimize={() => setIsMinimized(true)}
                    />
                    <Title className='font-size-3 frame-atoms-table-header-title'>{title}</Title>
                </Container>

                <Container className='p-1 overflow-auto frame-atoms-table-body-container'>
                    <DocumentListingTable
                        columns={columns}
                        data={rows}
                        isLoading={isInitialLoading}
                        useVirtualization={true}
                        listHeight={isMaximized ? window.innerHeight - 200 : 500}
                        enableInfinite={true}
                        hasMore={hasMore}
                        onLoadMore={handleLoadMore}
                        isFetchingMore={loading && rows.length > 0}
                        keyExtractor={(item: any) => `particle-${item.idx}`}
                    />
                </Container>
            </Container>
        </Draggable>
    );
};

export default PluginAtomsTable;
