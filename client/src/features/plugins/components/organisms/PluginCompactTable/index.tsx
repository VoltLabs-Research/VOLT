/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { List, type RowComponentProps } from 'react-window';
import '@/features/plugins/components/organisms/PluginExposureTable/PluginExposureTable.css';

export interface ColumnConfig {
    key: string;
    title: string;
    width?: number;
    render?: (value: any, row: any) => React.ReactNode;
}

interface RowProps {
    data: any[];
    columns: ColumnConfig[];
}

const TableRow = ({ index, style, data: rows, columns }: { index: number; style: React.CSSProperties; data: any[]; columns: ColumnConfig[] }) => {
    const row = rows[index];
    if (!row) return null;

    return (
        <div style={style} className="plugin-compact-table-row">
            {columns.map((col) => (
                <div
                    key={col.key}
                    className="plugin-compact-table-cell overflow-hidden font-size-1 color-secondary"
                    style={{
                        width: col.width ? `${col.width}px` : 'auto',
                        flex: col.width ? '0 0 auto' : '1'
                    }}
                >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                </div>
            ))}
        </div>
    );
};

const VirtualizedRow = (props: any) => {
    const { index, style, data, columns } = props;
    return <TableRow index={index} style={style} data={data} columns={columns} />;
};

interface PluginCompactTableProps {
    columns: ColumnConfig[];
    data: any[];
    hasMore?: boolean;
    isLoading?: boolean;
    isFetchingMore?: boolean;
    onLoadMore?: () => void;
    error?: string | null;
    rowHeight?: number;
    onDataReady?: (columns: ColumnConfig[], data: any[]) => void;
}

const PluginCompactTable = ({
    columns,
    data,
    hasMore,
    isLoading,
    isFetchingMore,
    onLoadMore,
    error,
    rowHeight = 28,
    onDataReady,
}: PluginCompactTableProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(400);

    // Calculate total width of all columns
    const totalWidth = columns.reduce((sum, col) => sum + (col.width || 150), 0);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setHeight(entry.contentRect.height - 32);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Notify parent when data is ready for export
    useEffect(() => {
        if (onDataReady && columns.length > 0 && data.length > 0) {
            onDataReady(columns, data);
        }
    }, [columns, data, onDataReady]);

    const lastScrollOffset = useRef(0);

    const handleScroll = useCallback((eventOrProps: any) => {
        if (!hasMore || isLoading || isFetchingMore || !onLoadMore) return;

        let scrollOffset = 0;
        if (typeof eventOrProps.scrollOffset === 'number') {
            scrollOffset = eventOrProps.scrollOffset;
        } else if (eventOrProps.target && typeof eventOrProps.target.scrollTop === 'number') {
            scrollOffset = eventOrProps.target.scrollTop;
        }

        const totalHeight = data.length * rowHeight;
        const scrollThreshold = totalHeight - height - 200;

        if (scrollOffset > lastScrollOffset.current && scrollOffset >= scrollThreshold) {
            onLoadMore();
        }

        lastScrollOffset.current = scrollOffset;
    }, [data.length, hasMore, isLoading, isFetchingMore, onLoadMore, rowHeight, height]);

    if (isLoading && data.length === 0) {
        return <div className="plugin-exposure-loading">Loading...</div>;
    }

    if (error) {
        return <div className="plugin-exposure-error">{error}</div>;
    }

    if (data.length === 0) {
        return <div className="plugin-exposure-empty">No data available</div>;
    }

    return (
        <div
            className="plugin-exposure-table-compact w-max h-max overflow-hidden"
            ref={containerRef}
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflowX: 'auto',
                overflowY: 'auto'
            }}
        >
            <div style={{ minWidth: `${totalWidth}px`, display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="plugin-compact-table-header p-sticky">
                    {columns.map((col) => (
                        <div
                            key={col.key}
                            className="plugin-compact-table-header-cell overflow-hidden font-weight-5"
                            style={{
                                width: col.width ? `${col.width}px` : 'auto',
                                flex: col.width ? '0 0 auto' : '1'
                            }}
                        >
                            {col.title}
                        </div>
                    ))}
                </div>
                <div
                    className="plugin-compact-table-list-container"
                    style={{ flex: 1, minHeight: 0 }}
                >
                    <List
                        onScroll={handleScroll}
                        rowCount={data.length}
                        rowHeight={rowHeight}
                        rowComponent={VirtualizedRow}
                        rowProps={{
                            data,
                            columns,
                        }}
                        style={{ height: Math.max(0, height), width: totalWidth, overflowX: 'hidden' }}
                    />
                </div>
            </div>
            {isFetchingMore && (
                <div className="plugin-exposure-loading" style={{ padding: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    Loading more...
                </div>
            )}
        </div>
    );
};

export default PluginCompactTable;
