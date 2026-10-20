import Scrollable from '@/shared/ui/components/Scrollable';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import { cn } from '@heroui/react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { Key, ReactNode } from 'react';

interface AutoScrollListProps<T> {
    items: T[];
    isLoading: boolean;
    renderItem: (item: T, index: number) => ReactNode;
    getItemKey?: (item: T, index: number) => Key;
    className?: string;
    hasMore?: boolean;
    onLoadMore?: () => void;
    loadMoreThreshold?: number;
    loadMoreIndicator?: ReactNode;
    renderLoading?: ReactNode;
    loadingClassName?: string;
    renderEmpty?: ReactNode;
    emptyClassName?: string;
    renderAfter?: ReactNode;
    autoScrollDependency?: unknown;
    autoScrollDependencyEnabled?: boolean;
    preserveScrollOnPrepend?: boolean;
    autoScrollBottomThreshold?: number;
};

interface ScrollSnapshot {
    scrollHeight: number;
    scrollTop: number;
    wasNearBottom: boolean;
}

const AutoScrollList = <T,>({
    items,
    isLoading,
    renderItem,
    getItemKey,
    className,
    hasMore,
    onLoadMore,
    loadMoreThreshold = 100,
    loadMoreIndicator,
    renderLoading,
    loadingClassName,
    renderEmpty,
    emptyClassName,
    renderAfter,
    autoScrollDependency,
    autoScrollDependencyEnabled = false,
    preserveScrollOnPrepend = false,
    autoScrollBottomThreshold = 120
}: AutoScrollListProps<T>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousItemsLengthRef = useRef(items.length);
    const previousFirstItemKeyRef = useRef<Key | null>(items.length > 0 ? (getItemKey ? getItemKey(items[0], 0) : 0) : null);
    const previousLastItemKeyRef = useRef<Key | null>(items.length > 0 ? (getItemKey ? getItemKey(items[items.length - 1], items.length - 1) : items.length - 1) : null);
    const scrollSnapshotRef = useRef<ScrollSnapshot>({
        scrollHeight: 0,
        scrollTop: 0,
        wasNearBottom: true
    });
    const prefersReducedMotion = usePrefersReducedMotion();
    const hasItems = items.length > 0;

    const getItemKeyValue = useCallback((item: T, index: number): Key => {
        return getItemKey ? getItemKey(item, index) : index;
    }, [getItemKey]);

    const updateScrollSnapshot = useCallback(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

        scrollSnapshotRef.current = {
            scrollHeight: container.scrollHeight,
            scrollTop: container.scrollTop,
            wasNearBottom: distanceFromBottom <= autoScrollBottomThreshold
        };
    }, [autoScrollBottomThreshold]);

    const scrollToBottom = useCallback((smooth: boolean) => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        let behavior: ScrollBehavior = 'auto';

        if (smooth && !prefersReducedMotion) {
            behavior = 'smooth';
        }

        container.scrollTo({
            top: container.scrollHeight,
            behavior
        });
    }, [prefersReducedMotion]);

    useLayoutEffect(() => {
        const previousItemsLength = previousItemsLengthRef.current;
        const previousFirstItemKey = previousFirstItemKeyRef.current;
        const previousLastItemKey = previousLastItemKeyRef.current;
        const previousSnapshot = scrollSnapshotRef.current;
        const nextFirstItemKey = items.length > 0 ? getItemKeyValue(items[0], 0) : null;
        const nextLastItemKey = items.length > 0 ? getItemKeyValue(items[items.length - 1], items.length - 1) : null;
        const hasPrependedItems = preserveScrollOnPrepend
            && items.length > previousItemsLength
            && previousItemsLength > 0
            && previousFirstItemKey !== nextFirstItemKey
            && previousLastItemKey === nextLastItemKey;
        const hasAppendedItems = items.length > previousItemsLength
            && previousItemsLength > 0
            && previousFirstItemKey === nextFirstItemKey
            && previousLastItemKey !== nextLastItemKey;

        if (hasPrependedItems && containerRef.current) {
            const scrollDelta = containerRef.current.scrollHeight - previousSnapshot.scrollHeight;
            containerRef.current.scrollTop = previousSnapshot.scrollTop + scrollDelta;
        } else if (previousItemsLength === 0 && items.length > 0) {
            scrollToBottom(false);
        } else if (hasAppendedItems && previousSnapshot.wasNearBottom) {
            scrollToBottom(true);
        }

        previousItemsLengthRef.current = items.length;
        previousFirstItemKeyRef.current = nextFirstItemKey;
        previousLastItemKeyRef.current = nextLastItemKey;
        updateScrollSnapshot();
    }, [items, getItemKeyValue, preserveScrollOnPrepend, scrollToBottom, updateScrollSnapshot]);

    useEffect(() => {
        updateScrollSnapshot();
    }, [items.length, isLoading, updateScrollSnapshot]);

    useEffect(() => {
        if (!autoScrollDependencyEnabled || autoScrollDependency == null) {
            return;
        }

        scrollToBottom(true);
    }, [autoScrollDependency, autoScrollDependencyEnabled, scrollToBottom]);

    const handleScroll = () => {
        updateScrollSnapshot();

        if (!containerRef.current || !hasMore || isLoading || !onLoadMore) {
            return;
        }

        if (containerRef.current.scrollTop < loadMoreThreshold) {
            onLoadMore();
        }
    };

    const listClassName = cn('flex flex-col gap-2 flex-1 overscroll-contain', className);

    if (isLoading && items.length === 0) {
        return (
            <Scrollable className={cn(listClassName, loadingClassName)} role='status' aria-live='polite' aria-atomic='true'>
                {renderLoading}
            </Scrollable>
        );
    }

    if (items.length === 0) {
        return (
            <div className={cn('flex items-center justify-center flex-1', className, emptyClassName)} role='status' aria-live='polite' aria-atomic='true'>
                {renderEmpty}
            </div>
        );
    }

    return (
        <Scrollable ref={containerRef} className={listClassName} onScroll={handleScroll} role='log' aria-live='polite' aria-relevant='additions text' aria-atomic='false' aria-busy={isLoading} aria-label='Auto-updating content'>
            {hasMore ? loadMoreIndicator : null}
            {items.map((item, index) => (
                <Fragment key={getItemKey ? getItemKey(item, index) : index}>
                    {renderItem(item, index)}
                </Fragment>
            ))}
            {renderAfter}
            <div className='min-h-px' aria-hidden={hasItems} />
        </Scrollable>
    );
};

export default AutoScrollList;
