import Container from '@/shared/presentation/components/Container';
import getListingDisplayState from '@/shared/presentation/components/DocumentListing/listing-state';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import TableRow from '@/shared/presentation/components/TableRow';
import TableSkeletonRow from '@/shared/presentation/components/TableSkeletonRow';
import Title from '@/shared/presentation/components/Title';
import useInfiniteScroll from '@/shared/presentation/hooks/use-infinite-scroll';
import './DocumentListingTable.css';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { FileText } from 'lucide-react';
import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import React from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { SelectOption } from '@/shared/presentation/components/Select';
import type { DragEndEvent } from '@dnd-kit/core';

const MIN_COLUMN_WIDTH = 180;
const MAX_COLUMN_WIDTH = 280;
const COLUMN_GAP = 16;

const COMPACT_MIN_COLUMN_WIDTH = 80;
const COMPACT_MAX_COLUMN_WIDTH = 200;
const COMPACT_COLUMN_GAP = 8;

export interface Identifiable {
    _id: string;
};

export enum EditableType {
    Text = 'text',
    Number = 'number',
    Select = 'select'
};

export interface EditableConfig<TRow = unknown> {
    type: EditableType;
    onSave: (row: TRow, newValue: string) => void | Promise<void>;
    options?: SelectOption[];
    canEdit?: (row: TRow) => boolean;
};

export interface ColumnConfig<TRow = unknown> {
    key?: string;
    title?: string;
    path?: string;
    label?: string;
    width?: number;
    render?: (value: unknown, row: TRow) => React.ReactNode;
    skeleton?: { variant: 'text' | 'rounded'; width: number; height?: number };
    sortable?: boolean;
    editable?: EditableConfig<TRow>;
};

interface DocumentListingTableProps<T extends Identifiable> {
    listingLabel?: string;
    columns: ColumnConfig<T>[];
    data: T[];
    onCellClick?: (col: ColumnConfig<T>) => void;
    onItemClick?: (item: T, event: React.MouseEvent) => boolean;
    getCellTitle?: (col: ColumnConfig<T>) => React.ReactNode;
    getAriaSort?: (col: ColumnConfig<T>) => 'ascending' | 'descending' | 'none';
    isLoading?: boolean;
    getMenuOptions?: (item: T, selectedItems: T[]) => MenuOption[];
    dragAndDrop?: DocumentListingDragAndDropConfig<T>;
    emptyMessage?: string;
    hasMore?: boolean;
    isFetchingMore?: boolean;
    onLoadMore?: () => void;
    skeletonRowsCount?: number;
    scrollContainerRef?: React.RefObject<HTMLElement | null> | null;
    emptyButtonText?: string;
    onEmptyButtonClick?: () => void;
    errorMessage?: string | null;
    isAccessDenied?: boolean;
    onRetry?: () => void;
    retryButtonText?: string;
    compact?: boolean;
};

const getColumnTitle = <T,>(col: ColumnConfig<T>): string => String(col.title ?? col.label ?? col.key ?? col.path ?? '');

const DocumentListingTable = <T extends Identifiable>({
    listingLabel = 'Document listing',
    columns,
    data,
    onCellClick = () => {},
    onItemClick,
    getCellTitle = (col) => col.title,
    getAriaSort = () => 'none',
    isLoading = false,
    getMenuOptions,
    dragAndDrop,
    emptyMessage = 'No documents to show.',
    hasMore = false,
    isFetchingMore = false,
    onLoadMore,
    skeletonRowsCount = 8,
    scrollContainerRef = null,
    emptyButtonText,
    onEmptyButtonClick,
    errorMessage,
    isAccessDenied = false,
    onRetry,
    retryButtonText,
    compact = false
}: DocumentListingTableProps<T>) => {
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: dragAndDrop?.activationDistance ?? 6
            }
        })
    );

    const resolvedMinWidth = compact ? COMPACT_MIN_COLUMN_WIDTH : MIN_COLUMN_WIDTH;
    const resolvedMaxWidth = compact ? COMPACT_MAX_COLUMN_WIDTH : MAX_COLUMN_WIDTH;
    const resolvedGap = compact ? COMPACT_COLUMN_GAP : COLUMN_GAP;

    const columnWidths = useMemo(() => columns.map((col) => {
        if (typeof col.width === 'number' && col.width > 0) return col.width;
        const title = typeof col.title === 'string' ? col.title : col.label;
        const titleLength = typeof title === 'string' ? title.length : 10;
        return Math.max(resolvedMinWidth, Math.min(titleLength * 14, resolvedMaxWidth));
    }), [columns, resolvedMinWidth, resolvedMaxWidth]);

    const minContentWidth = useMemo(() => {
        const sum = columnWidths.reduce((acc, w) => acc + w, 0);
        return sum + (columns.length - 1) * resolvedGap;
    }, [columnWidths, columns.length, resolvedGap]);

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

    const {
        isInitialLoading,
        hasNoData,
        shouldShowContent,
        shouldShowEmptyState,
        shouldShowErrorState,
        shouldShowAccessDeniedState
    } = getListingDisplayState({
        dataLength: data.length,
        isLoading,
        errorMessage,
        isAccessDenied
    });

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

    const draggableIdsByItemId = useMemo(() => {
        const nextMap = new Map<string, string>();
        if (!dragAndDrop) {
            return nextMap;
        }

        data.forEach((item) => {
            const draggableId = dragAndDrop.getDraggableId(item);
            if (draggableId) {
                nextMap.set(item._id, draggableId);
            }
        });

        return nextMap;
    }, [data, dragAndDrop]);

    const droppableIdsByItemId = useMemo(() => {
        const nextMap = new Map<string, string>();
        if (!dragAndDrop) {
            return nextMap;
        }

        data.forEach((item) => {
            const droppableId = dragAndDrop.getDroppableId(item);
            if (droppableId) {
                nextMap.set(item._id, droppableId);
            }
        });

        return nextMap;
    }, [data, dragAndDrop]);

    const draggableItemsById = useMemo(() => {
        const nextMap = new Map<string, T>();
        if (!dragAndDrop) {
            return nextMap;
        }

        data.forEach((item) => {
            const draggableId = dragAndDrop.getDraggableId(item);
            if (draggableId) {
                nextMap.set(draggableId, item);
            }
        });

        return nextMap;
    }, [data, dragAndDrop]);

    const droppableItemsById = useMemo(() => {
        const nextMap = new Map<string, T>();
        if (!dragAndDrop) {
            return nextMap;
        }

        data.forEach((item) => {
            const droppableId = dragAndDrop.getDroppableId(item);
            if (droppableId) {
                nextMap.set(droppableId, item);
            }
        });

        return nextMap;
    }, [data, dragAndDrop]);

    const handleRowClick = useCallback((event: React.MouseEvent | React.KeyboardEvent, item: T) => {
        const isMouseEvent = 'ctrlKey' in event && 'metaKey' in event;
        const isMultiSelection = isMouseEvent && (event.ctrlKey || event.metaKey);

        setSelectedIds((prev) => {
            if (!isMultiSelection) {
                if (prev.size === 1 && prev.has(item._id)) {
                    return new Set();
                }
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

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        if (!dragAndDrop) {
            return;
        }

        const activeId = String(event.active.id);
        const overId = event.over ? String(event.over.id) : null;

        await dragAndDrop.onDragEnd({
            event,
            activeId,
            overId,
            activeItem: draggableItemsById.get(activeId) ?? null,
            overItem: overId ? droppableItemsById.get(overId) ?? null : null
        });
    }, [dragAndDrop, draggableItemsById, droppableItemsById]);

    const rows = !hasNoData && data.map((item) => (
        <TableRow
            key={item._id}
            item={item}
            columns={columns}
            columnWidths={columnWidths}
            getMenuOptions={getMenuOptions}
            selectedItems={selectedItems}
            isSelected={selectedIds.has(item._id)}
            onClick={handleRowClick}
            onItemClick={onItemClick}
            onContextMenu={handleRowContextMenu}
            useFlexDistribution={useFlexDistribution}
            columnGap={resolvedGap}
            dragIntentDistance={dragAndDrop?.activationDistance ?? 6}
            draggableId={draggableIdsByItemId.get(item._id) ?? null}
            droppableId={droppableIdsByItemId.get(item._id) ?? null}
        />
    ));

    return (
        <Container
            className={`d-flex column document-listing-table-container h-max ${compact ? 'is-compact' : ''}`}
            role='grid'
            aria-label={listingLabel}
            aria-colcount={columns.length}
            aria-rowcount={data.length}
            aria-busy={isLoading || isFetchingMore}
        >
            {columns.length > 0 && shouldShowContent && (
                <Container
                    className='document-listing-table-header-container p-sticky top-0 d-flex'
                    role='row'
                    style={{
                        width: effectiveWidth,
                        gap: useFlexDistribution ? undefined : `${resolvedGap}px`,
                        justifyContent: useFlexDistribution ? 'space-between' : 'flex-start'
                    }}
                >
                    {columns.map((col, colIdx) => (
                        <Container
                            className='document-listing-cell header-cell overflow-hidden d-flex items-center color-secondary'
                            key={`header-${getColumnTitle(col)}-${colIdx}`}
                            role='columnheader'
                            aria-sort={getAriaSort(col)}
                            style={
                                useFlexDistribution
                                    ? { flex: 1, minWidth: 0 }
                                    : { width: columnWidths[colIdx], minWidth: columnWidths[colIdx], maxWidth: columnWidths[colIdx], flexShrink: 0 }
                            }
                        >
                            {col.sortable ? (
                                <button
                                    type='button'
                                    className='document-listing-sort-button d-flex items-center color-secondary'
                                    onClick={() => onCellClick(col)}
                                    aria-label={`Sort by ${getColumnTitle(col)}`}
                                >
                                    <Title className='font-size-2-5 font-weight-5 color-secondary'>{getCellTitle(col)}</Title>
                                </button>
                            ) : (
                                <Title className='font-size-2-5 font-weight-5 color-secondary'>{getCellTitle(col)}</Title>
                            )}
                        </Container>
                    ))}
                </Container>
            )}

            <Container
                ref={bodyRef}
                className='d-flex column p-relative document-listing-table-body-container flex-1'
                role='rowgroup'
                style={{ minWidth: (useFlexDistribution || !shouldShowContent) ? undefined : `${minContentWidth}px` }}
            >
                {dragAndDrop ? (
                    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                        {rows}
                    </DndContext>
                ) : rows}

                {isFetchingMore && Array.from({ length: skeletonRowsCount }).map((_, i) => (
                    <TableSkeletonRow 
                        key={`fetching-${i}`} 
                        columns={columns} 
                        columnWidths={columnWidths} 
                        useFlexDistribution={useFlexDistribution}
                        columnGap={resolvedGap}
                    />
                ))}

                <Container ref={sentinelRef} style={{ height: 1 }} aria-hidden='true' />

                {shouldShowEmptyState && (
                    <RecoveryState
                        icon={<FileText size={26} strokeWidth={1.5} />}
                        title='Nothing here yet'
                        description={emptyMessage}
                        retryLabel={emptyButtonText}
                        onRetry={onEmptyButtonClick}
                    />
                )}

                {shouldShowErrorState && (
                    <RecoveryState
                        title='Unable to load this list'
                        description={errorMessage ?? 'Something went wrong while loading this data.'}
                        tone={RecoveryStateTone.Error}
                        retryLabel={retryButtonText}
                        isRetrying={isLoading}
                        onRetry={onRetry}
                    />
                )}

                {shouldShowAccessDeniedState && (
                    <RecoveryState
                        title='Access denied'
                        description={errorMessage ?? 'You do not have permission to view this list.'}
                        tone={RecoveryStateTone.AccessDenied}
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
                                    columnGap={resolvedGap}
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
