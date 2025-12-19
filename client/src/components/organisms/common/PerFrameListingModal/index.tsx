import { useEffect, useMemo, useRef, useState } from 'react';
import DocumentListingTable from '@/components/molecules/common/DocumentListingTable';
import type { ColumnConfig } from '@/components/organisms/common/DocumentListing';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import Draggable from '@/components/atoms/common/Draggable';
import pluginApi from '@/services/api/plugin';
import Container from '@/components/primitives/Container';
import type { PerFrameListingConfig } from '@/types/scene';
import './PerFrameListingModal.css';
import Title from '@/components/primitives/Title';

export type PerFrameListingModalProps = {
    item: any;
    config: {
        title: string;
        columns: Array<{ key: string; label: string; format?: string }>;
    };
    onClose: () => void;
};

const PerFrameListingModal = ({ item, config, onClose }: PerFrameListingModalProps) => {
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const columns: ColumnConfig[] = useMemo(() => config.columns.map(col => ({
        key: col.key,
        title: col.label,
        skeleton: { variant: 'text', width: 100 },
        render: (val: any) => {
            if(col.format === 'number' && typeof val === 'number'){
                return val.toFixed(4).replace(/\.?0+$/, '');
            }
            if(Array.isArray(val)) return val.join(', ');
            return String(val ?? '');
        }
    })), [config]);

    const fetchPage = async(pageNum: number) => {
        if(!item) return;
        setLoading(true);
        try{
            const analysis = item.analysis;
            const trajectoryId = analysis.trajectory?._id || analysis.trajectory || item.trajectory?._id || item.trajectory;
            const analysisId = analysis._id;
            const exposureId = analysis.modifier;
            const rawTimestep = String(item.timestep ?? analysis.timestep ?? 0).replace(/,/g, '');

            const data = await pluginApi.getPerFrameListing(
                trajectoryId,
                analysisId,
                exposureId,
                rawTimestep,
                { page: pageNum, limit: 50_000 }
            ) as any;

            setRows(prev => pageNum === 1 ? data.rows : [...prev, ...data.rows]);
            setHasMore(data.hasMore);
        }catch(err){
            console.error(err);
        }finally{
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        setRows([]);
        fetchPage(1);
    }, [item]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        const sentinel = sentinelRef.current;
        if(!container || !sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if(entry.isIntersecting && hasMore && !loading){
                    setPage((p) => {
                        const nextPage = p + 1;
                        fetchPage(nextPage);
                        return nextPage;
                    });
                }
            },
            { root: container, rootMargin: '0px 0px 200px 0px', threshold: 0 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loading]);

    if(isMinimized) return null;

    return (
        <Draggable
            enabled
            bounds='viewport'
            axis='both'
            doubleClickToDrag={true}
            handle='.per-frame-listing-modal-header-title'
            scaleWhileDragging={0.95}
            className='per-frame-listing-modal-draggable'
            resizable={true}
            minWidth={600}
            minHeight={400}
        >
            <Container className={`d-flex column per-frame-listing-modal-container primary-surface ${isMaximized ? 'maximized' : ''}`}>
                <Container className='d-flex gap-1-5 column p-1 u-select-none f-shrink-0'>
                    <WindowIcons
                        onClose={onClose}
                        onExpand={() => setIsMaximized(!isMaximized)}
                        onMinimize={() => setIsMinimized(true)}
                    />
                    <Title className='font-size-3 per-frame-listing-modal-header-title'>{config.title}</Title>
                </Container>

                <Container className='p-1 flex-1 overflow-auto' ref={scrollContainerRef}>
                    <DocumentListingTable
                        columns={columns}
                        data={rows}
                        isLoading={loading && rows.length === 0}
                    />
                    <Container style={{ padding: '0.5rem 1rem', opacity: 0.8 }}>
                        {loading && rows.length > 0 ? 'Loading more...' : ''}
                    </Container>
                    <Container ref={sentinelRef} style={{ height: 1 }} />
                </Container>
            </Container>
        </Draggable>
    );
};

export default PerFrameListingModal;
