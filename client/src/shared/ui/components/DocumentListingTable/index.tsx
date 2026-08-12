import getListingDisplayState from '@/shared/ui/components/DocumentListing/listing-state';
import useListingDragAndDrop from '@/shared/ui/components/DocumentListing/use-listing-drag-and-drop';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import TableRow from '@/shared/ui/components/TableRow';
import { Skeleton, cn } from '@heroui/react';
import { useInfiniteScroll } from '@/shared/ui/hooks/use-infinite-scroll';
import { DndContext } from '@dnd-kit/core';
import { FileText } from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';
import React from 'react';
import type { CSSProperties } from 'react';
import type { DocumentListingDragAndDropConfig } from '@/shared/ui/components/DocumentListing/drag-and-drop';
import type { MenuOption } from '@/shared/contracts/menu';
import type { Identifiable } from '@/shared/contracts/entity';

const DEFAULT_MIN_COLUMN_WIDTH = 140;
const COMPACT_MIN_COLUMN_WIDTH = 80;

const DEFAULT_COLUMN_GAP = 16;
const COMPACT_COLUMN_GAP = 8;

const DRAG_ACTIVATION_DISTANCE = 6;

const INITIAL_SKELETON_ROWS_COUNT = 20;

export type ListingDensity = 'default' | 'compact';

export interface ColumnConfig<TRow = unknown> {
    key?: string;
    title?: string;
    path?: string;
    label?: string;

    width?: number;

    minWidth?: number;

    flex?: number;

    numeric?: boolean;

    defaultHidden?: boolean;
    headerTitleClassName?: string;
    render?: (value: unknown, row: TRow) => React.ReactNode;
    skeleton?: { variant: 'text' | 'rounded'; width: number; height?: number };
    sortable?: boolean;
};

export const getColumnKey = <TRow,>(col: ColumnConfig<TRow>): string => col.key ?? col.path ?? '';

export const getColumnTitle = <TRow,>(col: ColumnConfig<TRow>): string => (
    col.title ?? col.label ?? col.key ?? col.path ?? ''
);

const resolvePositive = (value: number | undefined): number | undefined => (
    value !== undefined && value > 0 ? value : undefined
);

const resolveColumnMinWidth = <TRow,>(col: ColumnConfig<TRow>, fallbackMinWidth: number): number => (
    resolvePositive(col.width) ?? resolvePositive(col.minWidth) ?? fallbackMinWidth
);

const resolveColumnStyle = <TRow,>(
    col: ColumnConfig<TRow>,
    fallbackMinWidth: number
): CSSProperties => {
    const fixedWidth = resolvePositive(col.width);

    if(fixedWidth !== undefined){
        return {
            flex: `0 0 ${fixedWidth}px`,
            minWidth: fixedWidth,
            maxWidth: fixedWidth
        };
    }

    const minWidth = resolveColumnMinWidth(col, fallbackMinWidth);

    return {
        flex: `${resolvePositive(col.flex) ?? 1} 1 ${minWidth}px`,
        minWidth
    };
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

interface SkeletonRowsProps<T> {
    count: number;
    keyPrefix: string;
    columns: ColumnConfig<T>[];
    columnStyles: CSSProperties[];
    columnGap: number;
    density: ListingDensity;
};

const SkeletonRows = <T,>({ count, keyPrefix, columns, columnStyles, columnGap, density }: SkeletonRowsProps<T>) => (
    <>
        {Array.from({ length: count }).map((_, rowIndex) => (
            <div key={`${keyPrefix}-${rowIndex}`} className={cn({
                default: 'flex items-center cursor-pointer px-6 py-3.5 transition-[background-color,box-shadow,border-color,opacity] duration-150 hover:bg-surface-hover max-md:px-4 max-md:py-3',
                compact: 'flex items-center cursor-pointer box-border h-7 max-h-7 px-2 py-0.5 transition-[background-color,box-shadow,border-color,opacity] duration-150 hover:bg-surface-hover'
            }[density], 'shrink-0 cursor-auto')} role='row' aria-hidden='true' style={{ gap: `${columnGap}px` }}>
                {columns.map((col, colIdx) => {
                    const skeleton = col.skeleton ?? {
                        variant: 'text' as const,
                        width: 100
                    };

                    return (
                        <div className={cn({
                            default: 'flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-left no-underline text-sm text-muted max-md:text-sm',
                            compact: 'flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-left no-underline text-xs text-muted'
                        }[density], col.numeric && 'justify-end text-right tabular-nums')} data-label={col.title} key={`${getColumnKey(col) || colIdx}-skeleton`} role='gridcell' style={columnStyles[colIdx]}>
                            <span>
                                <Skeleton
                                    aria-hidden='true'
                                    className={skeleton.variant === 'rounded' ? 'shrink-0 rounded-xl' : 'shrink-0 origin-[0_55%] scale-y-[0.6] rounded-sm h-[1em]'}
                                    style={{
                                        width: skeleton.width,
                                        height: skeleton.height
                                    }}
                                />
                            </span>
                        </div>
                    );
                })}
            </div>
        ))}
    </>
);

const MemoizedTableRow = React.memo(TableRow) as typeof TableRow;

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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const {
        sensors,
        draggableIdByItemId,
        droppableIdByItemId,
        dispatchDragEnd
    } = useListingDragAndDrop(data, dragAndDrop, DRAG_ACTIVATION_DISTANCE);

    const density: ListingDensity = compact ? 'compact' : 'default';
    const resolvedMinWidth = compact ? COMPACT_MIN_COLUMN_WIDTH : DEFAULT_MIN_COLUMN_WIDTH;
    const resolvedGap = compact ? COMPACT_COLUMN_GAP : DEFAULT_COLUMN_GAP;

    const columnStyles = useMemo(() => columns.map(
        (col) => resolveColumnStyle(col, resolvedMinWidth)
    ), [columns, resolvedMinWidth]);

    const minContentWidth = useMemo(() => {
        if(columns.length === 0) return 0;

        const sum = columns.reduce((acc, col) => acc + resolveColumnMinWidth(col, resolvedMinWidth), 0);

        return sum + (columns.length - 1) * resolvedGap;
    }, [columns, resolvedMinWidth, resolvedGap]);

    const { sentinelRef } = useInfiniteScroll({
        rootRef: scrollContainerRef,
        hasMore,
        isFetchingMore,
        onLoadMore
    });

    const {
        isInitialLoading,
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

    const selectedItems = useMemo(() => {
        if (selectedIds.size === 0) return [];
        return data.filter((item) => selectedIds.has(item._id));
    }, [data, selectedIds]);

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

    const rows = data.map((item) => (
        <MemoizedTableRow
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
            draggableId={draggableIdByItemId.get(item._id) ?? null}
            droppableId={droppableIdByItemId.get(item._id) ?? null}
            compact={compact}
        />
    ));

    return (
        <div className='flex h-full flex-col max-md:overflow-x-auto max-md:[-webkit-overflow-scrolling:touch]' role='grid' aria-label={listingLabel} aria-colcount={columns.length} aria-rowcount={data.length} aria-busy={isLoading || isFetchingMore}>
            {columns.length > 0 && shouldShowContent && (
                <div className={{
                    default: 'sticky top-0 z-[2] flex rounded-t-xl bg-surface-secondary px-6 py-3 max-md:px-4 max-md:py-3',
                    compact: 'sticky top-0 z-10 flex bg-surface-secondary px-2 py-1'
                }[density]} role='row' style={{
                    minWidth: `${minContentWidth}px`,
                    gap: `${resolvedGap}px`
                }}>
                    {columns.map((col, colIdx) => {
                        const columnTitle = getColumnTitle(col);
                        const cellClassName = cn(
                            'flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-left no-underline text-xs font-medium text-muted',
                            col.numeric && 'justify-end text-right tabular-nums'
                        );
                        const heading = (
                            <h3 className={cn('text-sm text-muted', col.headerTitleClassName ?? 'font-medium')}>
                                {getCellTitle(col)}
                            </h3>
                        );
                        return (
                            <div className={cellClassName} key={`header-${columnTitle}-${colIdx}`} role='columnheader' aria-sort={getAriaSort(col)} style={columnStyles[colIdx]}>
                                {col.sortable ? (
                                    <button
                                        type='button'
                                        className={cn('group flex w-full min-w-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-muted', col.numeric && 'justify-end')}
                                        onClick={() => onCellClick(col)}
                                        aria-label={`Sort by ${columnTitle}`}
                                    >
                                        {heading}
                                    </button>
                                ) : heading}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className={{
                default: 'relative flex flex-1 flex-col min-h-[400px]',
                compact: 'relative flex flex-1 flex-col min-h-0'
            }[density]} role='rowgroup' style={{ minWidth: shouldShowContent ? `${minContentWidth}px` : undefined }}>
                {dragAndDrop ? (
                    <DndContext sensors={sensors} onDragEnd={dispatchDragEnd}>
                        {rows}
                    </DndContext>
                ) : rows}

                <div ref={sentinelRef} style={{ height: 1 }} aria-hidden='true' />

                {isFetchingMore && (
                    <SkeletonRows
                        count={skeletonRowsCount}
                        keyPrefix='fetching'
                        columns={columns}
                        columnStyles={columnStyles}
                        columnGap={resolvedGap}
                        density={density}
                    />
                )}

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
                    <div className='absolute inset-0 z-[100] h-[calc(100dvh-320px)]'>
                        <div className='absolute inset-0 flex flex-col overflow-hidden'>
                            <SkeletonRows
                                count={INITIAL_SKELETON_ROWS_COUNT}
                                keyPrefix='loading-skeleton'
                                columns={columns}
                                columnStyles={columnStyles}
                                columnGap={resolvedGap}
                                density={density}
                            />
                        </div>
                    </div>
                )}
            </div>
            <div className={{ default: 'py-4 max-md:px-4 max-md:py-3', compact: 'py-1' }[density]} />
        </div>
    );
};

export default DocumentListingTable;
