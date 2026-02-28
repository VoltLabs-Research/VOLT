import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { FileText } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import TableRow from '@/shared/presentation/components/TableRow';
import TableSkeletonRow from '@/shared/presentation/components/TableSkeletonRow';
import EmptyState from '@/shared/presentation/components/EmptyState';
import useInfiniteScroll from '@/shared/presentation/hooks/use-infinite-scroll';
import getListingDisplayState from '@/shared/presentation/components/DocumentListing/listing-state';
import './DocumentListingTable.css';

const MIN_COLUMN_WIDTH = 180;
const MAX_COLUMN_WIDTH = 280;
const COLUMN_GAP = 16;

export interface Identifiable {
    _id: string;
}

export interface ColumnConfig {
    key?: string;
    title?: string;
    path?: string;
    label?: string;
    width?: number;
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

interface DocumentListingTableProps<T extends Identifiable> {
    columns: ColumnConfig[];
    data: T[];
    onCellClick?: (col: ColumnConfig) => void;
    getCellTitle?: (col: ColumnConfig) => React.ReactNode;
    isLoading?: boolean;
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
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
    if (typeof col.width === 'number' && col.width > 0) return col.width;
    const title = typeof col.title === 'string' ? col.title : col.label;
    const titleLength = typeof title === 'string' ? title.length : 10;
    return Math.max(MIN_COLUMN_WIDTH, Math.min(titleLength * 14, MAX_COLUMN_WIDTH));
};
const getColumnTitle = (col: ColumnConfig): string => String(col.title ?? col.label ?? col.key ?? col.path ?? '');

const DocumentListingTable = <T extends Identifiable>({
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
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const columnWidths = useMemo(() => columns.map(getColumnWidth), [columns]);
    const minContentWidth = useMemo(() => {
        const sum = columnWidths.reduce((acc, w) => acc + w, 0);
        return sum + (columns.length - 1) * COLUMN_GAP;
    }, [columnWidths, columns.length]);

    const useFlexDistribution = useMemo(() => {
        if (typeof window === 'undefined') {
            return false;
        }
        const availableWidth = window.innerWidth - 350;
        return availableWidth >= minContentWidth;
    }, [minContentWidth]);

    const effectiveWidth = useFlexDistribution ? '100%' : `${minContentWidth}px`;

    const rootRef = scrollContainerRef && 'current' in scrollContainerRef ? scrollContainerRef : null;
    const { sentinelRef } = useInfiniteScroll({
        rootRef,
        hasMore,
        isFetchingMore,
        onLoadMore
    });

    const { isInitialLoading, hasNoData, shouldShowEmptyState } = getListingDisplayState(data.length, isLoading);

    useEffect(() => {
        setSelectedIds((prev) => {
            if (prev.size === 0) return prev;
            const availableIds = new Set(data.map((item) => item._id));
            const next = new Set<string>();
            prev.forEach((id) => {
                if (availableIds.has(id)) {
                    next.add(id);
                }
            });
            return next.size === prev.size ? prev : next;
        });
    }, [data]);

    const selectedItems = useMemo(() => {
        if (selectedIds.size === 0) return [];
        return data.filter((item) => selectedIds.has(item._id));
    }, [data, selectedIds]);

    const handleRowClick = useCallback((event: React.MouseEvent, item: T) => {
        const isMultiSelection = event.ctrlKey || event.metaKey;

        setSelectedIds((prev) => {
            if (!isMultiSelection) {
                return new Set([item._id]);
            }

            const next = new Set(prev);
            if (next.has(item._id)) {
                next.delete(item._id);
            } else {
                next.add(item._id);
            }
            return next;
        });
    }, []);

    const handleRowContextMenu = useCallback((item: T) => {
        setSelectedIds((prev) => {
            if (prev.has(item._id)) return prev;
            return new Set([item._id]);
        });
    }, []);

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
                            key={`header-${getColumnTitle(col)}-${colIdx}`}
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
                className='d-flex column p-relative document-listing-table-body-container flex-1'
                style={{ minWidth: (useFlexDistribution || shouldShowEmptyState) ? undefined : `${minContentWidth}px` }}
            >
                {!hasNoData && data.map((item) => (
                    <TableRow
                        key={item._id}
                        item={item}
                        columns={columns}
                        columnWidths={columnWidths}
                        getMenuOptions={getMenuOptions}
                        selectedItems={selectedItems}
                        isSelected={selectedIds.has(item._id)}
                        onClick={handleRowClick}
                        onContextMenu={handleRowContextMenu}
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
