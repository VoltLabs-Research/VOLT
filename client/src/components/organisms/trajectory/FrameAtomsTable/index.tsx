import { useEffect, useMemo, useRef, useState } from 'react';
import DocumentListingTable from '@/components/molecules/common/DocumentListingTable';
import type { ColumnConfig } from '@/components/organisms/common/DocumentListing';
import useFrameAtoms from '@/hooks/trajectory/use-frame-atoms';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import './FrameAtomsTable.css';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';

export type FrameAtomsTableProps = {
    trajectoryId: string;
    timestep: number;
    pageSize?: number;
    initialPage?: number;
    decimals?: number;
    onClose?: () => void;
};

const FrameAtomsTable = ({
    trajectoryId,
    timestep,
    pageSize = 1000,
    initialPage = 1,
    decimals = 3,
    onClose
}: FrameAtomsTableProps) => {
    const [page, setPage] = useState<number>(initialPage);
    const [accRows, setAccRows] = useState<Array<{ idx: number; type?: number; x: number; y: number; z: number }>>([]);
    const [lastAppendedPage, setLastAppendedPage] = useState<number>(0);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setPage(initialPage);
        setAccRows([]);
        setLastAppendedPage(0);
    }, [trajectoryId, timestep, pageSize, initialPage]);

    const { data, loading } = useFrameAtoms(trajectoryId, timestep, { page, pageSize });

    const typePalette = useMemo(() => [
        '#1f77b4',
        '#ff7f0e',
        '#2ca02c',
        '#d62728',
        '#9467bd',
        '#8c564b',
        '#e377c2',
        '#7f7f7f',
        '#bcbd22',
        '#17becf',
        '#aec7e8',
        '#ffbb78',
        '#98df8a',
        '#ff9896',
        '#c5b0d5',
        '#c49c94',
        '#f7b6d2',
        '#c7c7c7',
        '#dbdb8d',
        '#9edae5'
    ], []);

    const typeToColor = (t?: number): string => {
        if (!Number.isFinite) return '#888888';
        const type = Math.max(1, Math.floor(t as number));
        if (type <= typePalette.length) return typePalette[type - 1];
        const hue = ((type - 1) * 47) % 360;
        return `hsl(${hue}deg 60% 55%)`;
    };

    const columns: ColumnConfig[] = useMemo(() => [
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
    ], [decimals, typePalette]);

    useEffect(() => {
        if (!data?.positions) return;
        const currPage = data.page ?? page;
        const currPageSize = data.pageSize ?? pageSize;
        const startIndex = (currPage - 1) * currPageSize;
        const types = data.types ?? [];
        const newRows = data.positions.map((pos: number[], i: number) => ({
            idx: startIndex + i + 1,
            type: Number.isFinite(types[i]) ? types[i] : undefined,
            x: pos[0],
            y: pos[1],
            z: pos[2],
        }));

        if (currPage <= 1 || lastAppendedPage === 0) {
            setAccRows(newRows);
            setLastAppendedPage(currPage);
            return;
        }

        if (currPage > lastAppendedPage) {
            setAccRows(prev => [...prev, ...newRows]);
            setLastAppendedPage(currPage);
        }
    }, [data, page, pageSize, lastAppendedPage]);

    const rows = accRows;

    const total = data?.total ?? data?.natoms;
    const effectivePageSize = data?.pageSize ?? pageSize;
    const hasMore = typeof total === 'number'
        ? rows.length < total
        : (data?.positions?.length ?? 0) === effectivePageSize;

    useEffect(() => {
        const container = scrollContainerRef.current;
        const sentinel = sentinelRef.current;
        if (!container || !sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && hasMore && !loading) {
                    setPage((p) => p + 1);
                }
            },
            { root: container, rootMargin: '0px 0px 200px 0px', threshold: 0 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loading]);

    const handleLoadMore = () => {
        if (hasMore && !loading) {
            setPage((p) => p + 1);
        }
    };

    const isInitialLoading = loading && rows.length === 0;

    if (isMinimized) return null;

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
                    <Title className='font-size-3 frame-atoms-table-header-title'>Particles</Title>
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

export default FrameAtomsTable;
