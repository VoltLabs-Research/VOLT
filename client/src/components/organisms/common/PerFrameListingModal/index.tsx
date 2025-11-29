import React, { useEffect, useMemo, useRef, useState } from 'react';
import DocumentListingTable from '@/components/molecules/common/DocumentListingTable';
import type { ColumnConfig } from '@/components/organisms/common/DocumentListing';
import WindowIcons from '@/components/molecules/common/WindowIcons';
import Draggable from '@/components/atoms/common/Draggable';
import { api } from '@/api';
import './PerFrameListingModal.css';

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
            if (col.format === 'number' && typeof val === 'number') {
                return val.toFixed(4).replace(/\.?0+$/, '');
            }
            if (Array.isArray(val)) return val.join(', ');
            return String(val ?? '');
        }
    })), [config]);

    const fetchPage = async (pageNum: number) => {
        if (!item) return;
        setLoading(true);
        try {
            const analysis = item.analysis;
            const trajectoryId = analysis.trajectory?._id || analysis.trajectory || item.trajectory?._id || item.trajectory;
            const analysisId = analysis._id;
            const exposureId = analysis.modifier;
            // Ensure timestep is a raw number string (remove commas if present)
            const rawTimestep = String(item.timestep ?? analysis.timestep ?? 0).replace(/,/g, '');

            const url = `/plugins/per-frame-listing/${trajectoryId}/${analysisId}/${exposureId}/${rawTimestep}`;

            const res = await api.get(url, { params: { page: pageNum, limit: 50_000 } });
            const data = res.data.data;

            setRows(prev => pageNum === 1 ? data.rows : [...prev, ...data.rows]);
            setHasMore(data.hasMore);
        } catch (err) {
            console.error(err);
        } finally {
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
        if (!container || !sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && hasMore && !loading) {
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

    if (isMinimized) return null;

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
            <div className={`per-frame-listing-modal-container primary-surface ${isMaximized ? 'maximized' : ''}`}>
                <div className='per-frame-listing-modal-header-container'>
                    <WindowIcons
                        onClose={onClose}
                        onExpand={() => setIsMaximized(!isMaximized)}
                        onMinimize={() => setIsMinimized(true)}
                    />
                    <h3 className='per-frame-listing-modal-header-title'>{config.title}</h3>
                </div>

                <div className='per-frame-listing-modal-body-container' ref={scrollContainerRef}>
                    <DocumentListingTable
                        columns={columns}
                        data={rows}
                        isLoading={loading && rows.length === 0}
                    />
                    <div style={{ padding: '0.5rem 1rem', opacity: 0.8 }}>
                        {loading && rows.length > 0 ? 'Loading more...' : ''}
                    </div>
                    <div ref={sentinelRef} style={{ height: 1 }} />
                </div>
            </div>
        </Draggable>
    );
};

export default PerFrameListingModal;
