import getListingDisplayState from '@/shared/ui/components/DocumentListing/listing-state';
import useListingDragAndDrop from '@/shared/ui/components/DocumentListing/use-listing-drag-and-drop';
import { ListingAccessDeniedState, ListingEmptyState, ListingErrorState } from '@/shared/ui/components/DocumentListing/ListingStates';
import Scrollable from '@/shared/ui/components/Scrollable';
import TableRow from '@/shared/ui/components/TableRow';
import { Skeleton, cn } from '@heroui/react';
import { useInfiniteScroll } from '@/shared/ui/hooks/use-infinite-scroll';
import { DndContext } from '@dnd-kit/core';
import { useMemo, useState, useCallback } from 'react';
import React from 'react';
import type { CSSProperties } from 'react';
import type { DocumentListingDragAndDropConfig } from '@/shared/ui/components/DocumentListing/drag-and-drop';
import type { MenuOption } from '@/shared/contracts/menu';
import type { Identifiable } from '@/shared/contracts/entity';
import type { ColumnConfig } from './column-config';
import { getColumnKey, getColumnTitle } from './column-config';

export type { ColumnConfig } from './column-config';

export { getColumnKey, getColumnTitle } from './column-config';

const MIN_COLUMN_WIDTH = 140;

// Each cell keeps 16px on either side, as the mockup's table does; the header's separators sit in
// the middle of the gap.
const COLUMN_GAP = 32;

const DRAG_ACTIVATION_DISTANCE = 6;

const INITIAL_SKELETON_ROWS_COUNT = 6;

const ROW_CLASS = 'flex min-h-14 items-center px-4 py-2 not-first:border-t not-first:border-separator/60';

const CELL_CLASS = 'flex min-w-0 items-center overflow-hidden text-ellipsis whitespace-nowrap text-left';

const resolvePositive = (value: number | undefined): number | undefined => (
    value !== undefined && value > 0 ? value : undefined
);

const resolveColumnMinWidth = <TRow,>(col: ColumnConfig<TRow>): number => (
    resolvePositive(col.width) ?? resolvePositive(col.minWidth) ?? MIN_COLUMN_WIDTH
);

const resolveColumnStyle = <TRow,>(col: ColumnConfig<TRow>): CSSProperties => {
    const fixedWidth = resolvePositive(col.width);

    if(fixedWidth !== undefined){
        return {
            flex: `0 0 ${fixedWidth}px`,
            minWidth: fixedWidth,
            maxWidth: fixedWidth
        };
    }

    const minWidth = resolveColumnMinWidth(col);

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
    emptyIcon?: React.ReactNode;
    emptyTitle?: string;
    emptyMessage?: string;
    hasMore?: boolean;
    isFetchingMore?: boolean;
    onLoadMore?: () => void;
    skeletonRowsCount?: number;
    scrollContainerRef?: React.RefObject<HTMLDivElement | null> | null;
    emptyButtonText?: string;
    onEmptyButtonClick?: () => void;
    emptyButtonIsLoading?: boolean;
    errorMessage?: string | null;
    isAccessDenied?: boolean;
    onRetry?: () => void;
    retryButtonText?: string;
};

interface SkeletonRowsProps<T> {
    count: number;
    keyPrefix: string;
    columns: ColumnConfig<T>[];
    columnStyles: CSSProperties[];
};

const SkeletonRows = <T,>({ count, keyPrefix, columns, columnStyles }: SkeletonRowsProps<T>) => (
    <>
        {Array.from({ length: count }).map((_, rowIndex) => (
            <div key={`${keyPrefix}-${rowIndex}`} className={ROW_CLASS} role='row' aria-hidden='true' style={{ gap: COLUMN_GAP }}>
                {columns.map((col, colIdx) => {
                    const skeleton = col.skeleton ?? {
                        variant: 'text' as const,
                        width: 100
                    };

                    return (
                        <div className={cn(CELL_CLASS, col.numeric && 'justify-end')} key={`${getColumnKey(col) || colIdx}-skeleton`} role='gridcell' style={columnStyles[colIdx]}>
                            <Skeleton
                                aria-hidden='true'
                                className={cn('max-w-full shrink-0 rounded-md', skeleton.variant === 'text' && 'h-3')}
                                style={{
                                    width: skeleton.width,
                                    height: skeleton.variant === 'text' ? undefined : skeleton.height
                                }}
                            />
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
    emptyIcon,
    emptyTitle = 'No items to show',
    emptyMessage = 'No documents to show.',
    hasMore = false,
    isFetchingMore = false,
    onLoadMore,
    skeletonRowsCount = 8,
    scrollContainerRef = null,
    emptyButtonText,
    onEmptyButtonClick,
    emptyButtonIsLoading = false,
    errorMessage,
    isAccessDenied = false,
    onRetry,
    retryButtonText
}: DocumentListingTableProps<T>) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const {
        sensors,
        draggableIdByItemId,
        droppableIdByItemId,
        dispatchDragEnd
    } = useListingDragAndDrop(data, dragAndDrop, DRAG_ACTIVATION_DISTANCE);

    const columnStyles = useMemo(() => columns.map(resolveColumnStyle), [columns]);

    const minContentWidth = useMemo(() => {
        if(columns.length === 0) return 0;

        const sum = columns.reduce((acc, col) => acc + resolveColumnMinWidth(col), 0);

        // The rows' own 16px inset on both sides.
        return sum + (columns.length - 1) * COLUMN_GAP + 32;
    }, [columns]);

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

    if (shouldShowEmptyState) {
        return (
            <ListingEmptyState
                icon={emptyIcon}
                title={emptyTitle}
                description={emptyMessage}
                actionLabel={emptyButtonText}
                onAction={onEmptyButtonClick}
                isActionPending={emptyButtonIsLoading}
            />
        );
    }

    if (shouldShowErrorState) {
        return (
            <ListingErrorState
                title="Couldn't load this list"
                description={errorMessage ?? 'Try again in a moment.'}
                retryLabel={retryButtonText}
                isRetrying={isLoading}
                onRetry={onRetry}
            />
        );
    }

    if (shouldShowAccessDeniedState) {
        return <ListingAccessDeniedState description={errorMessage ?? "You don't have permission to view this list."} />;
    }

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
            columnGap={COLUMN_GAP}
            draggableId={draggableIdByItemId.get(item._id) ?? null}
            droppableId={droppableIdByItemId.get(item._id) ?? null}
        />
    ));

    // The frame holds to its rows and grows up to the page; past that the body scrolls under a
    // header that stays put. HeroUI's primary table finish: the header on the frame, the rows on
    // the page's own background inset 4px, so its corners are the frame's minus that inset.
    return (
        <div
            className='flex max-h-full min-h-0 flex-col overflow-x-auto overflow-y-hidden rounded-2xl bg-surface-secondary px-1 pb-1 [-webkit-overflow-scrolling:touch]'
            role='grid'
            aria-label={listingLabel}
            aria-colcount={columns.length}
            aria-rowcount={data.length}
            aria-busy={isLoading || isFetchingMore}
        >
            {columns.length > 0 && (shouldShowContent || isInitialLoading) && (
                // Over the canvas, not the frame's translucent fill alone: rows scrolled under it
                // would otherwise show through.
                <div
                    className='sticky top-0 z-[2] flex shrink-0 bg-canvas bg-linear-to-b from-surface-secondary to-surface-secondary px-4 py-2.5'
                    role='row'
                    style={{
                        minWidth: minContentWidth,
                        gap: COLUMN_GAP
                    }}
                >
                    {columns.map((col, colIdx) => {
                        const columnTitle = getColumnTitle(col);
                        const heading = (
                            <h3 className={cn('min-w-0 truncate text-xs', col.headerTitleClassName ?? 'font-medium')}>
                                {getCellTitle(col)}
                            </h3>
                        );
                        return (
                            <div
                                className={cn(
                                    'relative flex items-center text-left text-xs font-medium text-muted',
                                    'not-last:after:absolute not-last:after:top-1/2 not-last:after:-right-4 not-last:after:h-4 not-last:after:w-px not-last:after:-translate-y-1/2 not-last:after:rounded-sm not-last:after:bg-separator',
                                    col.numeric && 'justify-end text-right tabular-nums'
                                )}
                                key={`header-${columnTitle}-${colIdx}`}
                                role='columnheader'
                                aria-sort={getAriaSort(col)}
                                style={columnStyles[colIdx]}
                            >
                                {col.sortable ? (
                                    <button
                                        type='button'
                                        className={cn('group flex w-full min-w-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-muted transition-colors duration-150 hover:text-foreground', col.numeric && 'justify-end')}
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

            <div className='flex min-h-0 shrink flex-col overflow-clip rounded-xl bg-canvas' style={{ minWidth: minContentWidth }}>
                <Scrollable ref={scrollContainerRef} className='relative flex min-h-0 flex-col' role='rowgroup'>
                    {dragAndDrop ? (
                        <DndContext sensors={sensors} onDragEnd={dispatchDragEnd}>
                            {rows}
                        </DndContext>
                    ) : rows}

                    {isInitialLoading && (
                        <SkeletonRows
                            count={INITIAL_SKELETON_ROWS_COUNT}
                            keyPrefix='loading-skeleton'
                            columns={columns}
                            columnStyles={columnStyles}
                        />
                    )}

                    {isFetchingMore && (
                        <SkeletonRows
                            count={skeletonRowsCount}
                            keyPrefix='fetching'
                            columns={columns}
                            columnStyles={columnStyles}
                        />
                    )}

                    <div ref={sentinelRef} className='h-px shrink-0' aria-hidden='true' />
                </Scrollable>
            </div>
        </div>
    );
};

export default DocumentListingTable;
