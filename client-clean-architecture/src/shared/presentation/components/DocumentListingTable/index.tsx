import React, { useRef, useMemo, useEffect } from 'react';
import { FileText } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import TableRow from '@/shared/presentation/components/TableRow';
import TableSkeletonRow from '@/shared/presentation/components/TableSkeletonRow';
import EmptyState from '@/shared/presentation/components/EmptyState';
import { extractItemKey } from '@/shared/utils/keys';
import './DocumentListingTable.css';

const MIN_COLUMN_WIDTH = 180;
const MAX_COLUMN_WIDTH = 280;
const COLUMN_GAP = 16;

export interface ColumnConfig {
    key: string;
    title: string;
    render?: (value: unknown, row?: unknown) => React.ReactNode;
    skeleton?: { variant: 'text' | 'rounded'; width: number; height?: number };
    sortable?: boolean;
};

export interface MenuOption {
    label: string;
    icon?: React.ComponentType;
    onClick: () => void | Promise<void>;
    destructive?: boolean;
};

interface DocumentListingTableProps<T = unknown> {
    columns: ColumnConfig[];
    data: T[];
    onCellClick?: (col: ColumnConfig) => void;
    getCellTitle?: (col: ColumnConfig) => React.ReactNode;
    isLoading?: boolean;
    getMenuOptions?: (item: T) => MenuOption[];
    emptyMessage?: string;
    hasMore?: boolean;
    isFetchingMore?: boolean;
    onLoadMore?: () => void;
    skeletonRowsCount?: number;
    scrollContainerRef?: React.RefObject<HTMLElement> | null;
    emptyButtonText?: string;
    onEmptyButtonClick?: () => void;
};

const getColumnWidth = (col: ColumnConfig): number => {
    const titleLength = col.title?.length ?? 10;
    return Math.max(MIN_COLUMN_WIDTH, Math.min(titleLength * 14, MAX_COLUMN_WIDTH));
};

const DocumentListingTable = <T,>({
    columns,
    data,
    onCellClick = () => {},
    getCellTitle = (col) => col.title,
    isLoading = false,
    getMenuOptions,
    emptyMessage = 'No documents to show.',
    hasMore = false,
    isFetchingMore = false,
    onLoadMore,
    skeletonRowsCount = 8,
    scrollContainerRef = null,
    emptyButtonText,
    onEmptyButtonClick
}: DocumentListingTableProps<T>) => {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const hasMountedRef = useRef(false);

    // Prevent auto-load on mount - wait for initial content to render
    useEffect(() => {
        const timer = setTimeout(() => {
            hasMountedRef.current = true;
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const columnWidths = useMemo(() => columns.map(getColumnWidth), [columns]);
    const minContentWidth = useMemo(() => {
        const sum = columnWidths.reduce((acc, w) => acc + w, 0);
        return sum + (columns.length - 1) * COLUMN_GAP;
    }, [columnWidths, columns.length]);

    const useFlexDistribution = useMemo(() => {
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const availableWidth = viewportWidth - 350;
        return availableWidth >= minContentWidth;
    }, [minContentWidth]);

    const effectiveWidth = useFlexDistribution ? '100%' : `${minContentWidth}px`;

    useEffect(() => {
        const root = scrollContainerRef && 'current' in scrollContainerRef ? scrollContainerRef.current : null;
        const sentinel = sentinelRef.current;
        if(!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if(entry?.isIntersecting && hasMore && !isFetchingMore && hasMountedRef.current) {
                    onLoadMore?.();
                }
            },
            { root: root ?? null, rootMargin: '0px 0px 200px 0px', threshold: 0 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [scrollContainerRef, hasMore, isFetchingMore, onLoadMore]);

    const isInitialLoading = isLoading && data.length === 0;
    const hasNoData = data.length === 0;
    const shouldShowEmptyState = hasNoData && !isLoading;

    return (
        <Container className='d-flex column document-listing-table-container h-max'>
            {columns.length > 0 && !shouldShowEmptyState && (
                <Container
                    className='document-listing-table-header-container p-sticky top-0 d-flex'
                    style={{
                        width: effectiveWidth,
                        gap: useFlexDistribution ? undefined : `${COLUMN_GAP}px`,
                        justifyContent: useFlexDistribution ? 'space-between' : 'flex-start'
                    }}
                >
                    {columns.map((col, colIdx) => (
                        <Container
                            className={`document-listing-cell header-cell ${col.sortable ? 'sortable cursor-pointer' : ''} overflow-hidden d-flex items-center color-primary`}
                            key={`header-${col.title}-${colIdx}`}
                            onClick={() => onCellClick(col)}
                            style={
                                useFlexDistribution
                                    ? { flex: 1, minWidth: 0 }
                                    : { width: columnWidths[colIdx], minWidth: columnWidths[colIdx], maxWidth: columnWidths[colIdx], flexShrink: 0 }
                            }
                        >
                            <Title className='font-size-2-5 font-weight-5 color-secondary'>{getCellTitle(col)}</Title>
                        </Container>
                    ))}
                </Container>
            )}

            <Container
                ref={bodyRef as React.RefObject<HTMLDivElement>}
                className='d-flex column p-relative document-listing-table-body-container flex-1 overflow-hidden'
                style={{ minWidth: useFlexDistribution ? undefined : `${minContentWidth}px` }}
            >
                {!hasNoData && data.map((item, idx) => (
                    <TableRow
                        key={extractItemKey(item, idx)}
                        item={item}
                        index={idx}
                        columns={columns}
                        columnWidths={columnWidths}
                        getMenuOptions={getMenuOptions}
                        useFlexDistribution={useFlexDistribution}
                        columnGap={COLUMN_GAP}
                    />
                ))}

                {isFetchingMore && Array.from({ length: skeletonRowsCount }).map((_, i) => (
                    <TableSkeletonRow 
                        key={`fetching-${i}`} 
                        columns={columns} 
                        columnWidths={columnWidths} 
                        useFlexDistribution={useFlexDistribution}
                        columnGap={COLUMN_GAP}
                    />
                ))}

                <Container ref={sentinelRef} style={{ height: 1 }} />

                {shouldShowEmptyState && (
                    <EmptyState
                        icon={<FileText size={26} strokeWidth={1.5} />}
                        title='Nothing here yet'
                        description={emptyMessage}
                        buttonText={emptyButtonText}
                        buttonOnClick={onEmptyButtonClick}
                    />
                )}

                {isInitialLoading && (
                    <Container className='document-listing-overlay-blur p-absolute inset-0'>
                        <Container className='document-listing-infinite-skeleton-loader p-absolute inset-0 overflow-hidden d-flex column'>
                            {Array.from({ length: 20 }).map((_, index) => (
                                <TableSkeletonRow 
                                    key={`loading-skeleton-${index}`} 
                                    columns={columns} 
                                    columnWidths={columnWidths} 
                                    useFlexDistribution={useFlexDistribution}
                                    columnGap={COLUMN_GAP}
                                />
                            ))}
                        </Container>
                    </Container>
                )}
            </Container>

            <Container className='document-listing-table-footer-container' />
        </Container>
    );
};

export default DocumentListingTable;
