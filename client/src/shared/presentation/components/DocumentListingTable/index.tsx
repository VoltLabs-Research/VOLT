import getListingDisplayState from '@/shared/presentation/components/DocumentListing/listing-state';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import { buildItemMapByGeneratedId } from '@/shared/presentation/components/DocumentListing/dnd-maps';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import TableRow from '@/shared/presentation/components/TableRow';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
import useInfiniteScroll from '@/shared/presentation/hooks/use-infinite-scroll';
import './DocumentListingTable.css';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { FileText } from 'lucide-react';
import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import React from 'react';
import type { CSSProperties } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { SelectOption } from '@/shared/presentation/primitives/Select';
import type { DragEndEvent } from '@dnd-kit/core';

const DEFAULT_MIN_COLUMN_WIDTH = 140;
const COMPACT_MIN_COLUMN_WIDTH = 80;

const DEFAULT_COLUMN_GAP = 16;
const COMPACT_COLUMN_GAP = 8;

const resolveColumnStyle = <TRow,>(
    col: ColumnConfig<TRow>,
    fallbackMinWidth: number
): CSSProperties => {
    if (typeof col.width === 'number' && col.width > 0) {
        return {
            flex: `0 0 ${col.width}px`,
            minWidth: col.width,
            maxWidth: col.width
        };
    }

    const minWidth = typeof col.minWidth === 'number' && col.minWidth > 0
        ? col.minWidth
        : fallbackMinWidth;
    const flex = typeof col.flex === 'number' && col.flex > 0 ? col.flex : 1;

    return {
        flex: `${flex} 1 ${minWidth}px`,
        minWidth
    };
};

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
    /** Fixed pixel width. When set, the column does not flex. */
    width?: number;
    /** Minimum pixel width when the column flexes. Ignored if `width` is set. */
    minWidth?: number;
    /** Flex grow weight. Higher values claim more leftover space. Defaults to 1. */
    flex?: number;
    /** Numeric column — right-aligns header and cell, applies tabular-nums. */
    numeric?: boolean;
    /** Hidden unless the user opts in via the column picker. */
    defaultHidden?: boolean;
    headerTitleClassName?: string;
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

    const resolvedMinWidth = compact ? COMPACT_MIN_COLUMN_WIDTH : DEFAULT_MIN_COLUMN_WIDTH;
    const resolvedGap = compact ? COMPACT_COLUMN_GAP : DEFAULT_COLUMN_GAP;

    const columnStyles = useMemo(() => columns.map(
        (col) => resolveColumnStyle(col, resolvedMinWidth)
    ), [columns, resolvedMinWidth]);

    const minContentWidth = useMemo(() => {
        if (columns.length === 0) return 0;
        const sum = columns.reduce((acc, col) => {
            if (typeof col.width === 'number' && col.width > 0) return acc + col.width;
            return acc + (typeof col.minWidth === 'number' && col.minWidth > 0 ? col.minWidth : resolvedMinWidth);
        }, 0);
        return sum + (columns.length - 1) * resolvedGap;
    }, [columns, resolvedMinWidth, resolvedGap]);

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
        return buildItemMapByGeneratedId(data, Boolean(dragAndDrop), (item) => {
            return dragAndDrop?.getDraggableId(item);
        });
    }, [data, dragAndDrop]);

    const droppableItemsById = useMemo(() => {
        return buildItemMapByGeneratedId(data, Boolean(dragAndDrop), (item) => {
            return dragAndDrop?.getDroppableId(item);
        });
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
            columnStyles={columnStyles}
            getMenuOptions={getMenuOptions}
            selectedItems={selectedItems}
            isSelected={selectedIds.has(item._id)}
            onClick={handleRowClick}
            onItemClick={onItemClick}
            onContextMenu={handleRowContextMenu}
            columnGap={resolvedGap}
            draggableId={draggableIdsByItemId.get(item._id) ?? null}
            droppableId={droppableIdsByItemId.get(item._id) ?? null}
        />
    ));

    return (
        <div className={`d-flex column document-listing-table-container h-max ${compact ? 'is-compact' : ''}`} role='grid' aria-label={listingLabel} aria-colcount={columns.length} aria-rowcount={data.length} aria-busy={isLoading || isFetchingMore}>
            {columns.length > 0 && shouldShowContent && (
                <div className='document-listing-table-header-container p-sticky top-0 d-flex' role='row' style={{ minWidth: `${minContentWidth}px`, gap: `${resolvedGap}px` }}>
                    {columns.map((col, colIdx) => {
                        const isSorted = getAriaSort(col) !== 'none';
                        const cellClassName = [
                            'document-listing-cell',
                            'header-cell',
                            'overflow-hidden',
                            'd-flex',
                            'items-center',
                            'color-secondary',
                            isSorted ? 'is-sorted' : '',
                            col.numeric ? 'is-numeric' : ''
                        ].filter(Boolean).join(' ');
                        return (
                            <div className={cellClassName} key={`header-${getColumnTitle(col)}-${colIdx}`} role='columnheader' aria-sort={getAriaSort(col)} style={columnStyles[colIdx]}>
                                {col.sortable ? (
                                    <button
                                        type='button'
                                        className='document-listing-sort-button d-flex items-center color-secondary'
                                        onClick={() => onCellClick(col)}
                                        aria-label={`Sort by ${getColumnTitle(col)}`}
                                    >
                                        <h3 className={`font-size-2-5 color-secondary ${col.headerTitleClassName ?? 'font-weight-5'}`}>
                                            {getCellTitle(col)}
                                        </h3>
                                    </button>
                                ) : (
                                    <h3 className={`font-size-2-5 color-secondary ${col.headerTitleClassName ?? 'font-weight-5'}`}>
                                        {getCellTitle(col)}
                                    </h3>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div ref={bodyRef} className='d-flex column p-relative document-listing-table-body-container flex-1' role='rowgroup' style={{ minWidth: shouldShowContent ? `${minContentWidth}px` : undefined }}>
                {dragAndDrop ? (
                    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                        {rows}
                    </DndContext>
                ) : rows}

                <div ref={sentinelRef} style={{ height: 1 }} aria-hidden='true' />

                {isFetchingMore && Array.from({ length: skeletonRowsCount }).map((_, i) => (
                    <div key={`fetching-${i}`} className='document-listing-table-row-container skeleton-row d-flex f-shrink-0' role='row' aria-hidden='true' style={{ gap: `${resolvedGap}px` }}>
                        {columns.map((col, colIdx) => (
                            <div className={`document-listing-cell overflow-hidden d-flex items-center font-size-2 color-secondary ${col.numeric ? 'is-numeric' : ''}`} data-label={col.title} key={`${String(col.key ?? col.path ?? col.title ?? colIdx)}-skeleton`} role='gridcell' style={columnStyles?.[colIdx] ?? { flex: 1, minWidth: 0 }}>
                                <span className='document-listing-cell-value'>
                                    <Skeleton {...(col.skeleton ?? { variant: 'text', width: 100 })} animation='wave' style={{ borderRadius: col.skeleton?.variant === 'rounded' ? 12 : 4 }} />
                                </span>
                            </div>
                        ))}
                    </div>
                ))}

                {shouldShowEmptyState && (
                    <RecoveryState
                        icon={<FileText size={26} strokeWidth={1.5} />}
                        title='No items to show'
                        description={emptyMessage}
                        retryLabel={emptyButtonText}
                        onRetry={onEmptyButtonClick}
                    />
                )}

                {shouldShowErrorState && (
                    <RecoveryState
                        title="Couldn't load this list"
                        description={errorMessage ?? 'Try again in a moment.'}
                        tone={RecoveryStateTone.Error}
                        retryLabel={retryButtonText}
                        isRetrying={isLoading}
                        onRetry={onRetry}
                    />
                )}

                {shouldShowAccessDeniedState && (
                    <RecoveryState
                        title='Access denied'
                        description={errorMessage ?? "You don't have permission to view this list."}
                        tone={RecoveryStateTone.AccessDenied}
                    />
                )}

                {isInitialLoading && (
                    <div className='document-listing-overlay-blur p-absolute inset-0'>
                        <div className='document-listing-infinite-skeleton-loader p-absolute inset-0 overflow-hidden d-flex column'>
                            {Array.from({ length: 20 }).map((_, index) => (
                                <div key={`loading-skeleton-${index}`} className='document-listing-table-row-container skeleton-row d-flex f-shrink-0' role='row' aria-hidden='true' style={{ gap: `${resolvedGap}px` }}>
                                    {columns.map((col, colIdx) => (
                                        <div className={`document-listing-cell overflow-hidden d-flex items-center font-size-2 color-secondary ${col.numeric ? 'is-numeric' : ''}`} data-label={col.title} key={`${String(col.key ?? col.path ?? col.title ?? colIdx)}-skeleton`} role='gridcell' style={columnStyles?.[colIdx] ?? { flex: 1, minWidth: 0 }}>
                                            <span className='document-listing-cell-value'>
                                                <Skeleton {...(col.skeleton ?? { variant: 'text', width: 100 })} animation='wave' style={{ borderRadius: col.skeleton?.variant === 'rounded' ? 12 : 4 }} />
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className='document-listing-table-footer-container' />
        </div>
    );
};

export default DocumentListingTable;
