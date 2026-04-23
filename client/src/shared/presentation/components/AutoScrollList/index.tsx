import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import './AutoScrollList.css';
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

const joinClasses = (...classes: Array<string | undefined | false>) => (
    classes.filter(Boolean).join(' ')
);

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
    const bottomRef = useRef<HTMLDivElement>(null);
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
        let behavior: ScrollBehavior = 'auto';

        if (smooth && !prefersReducedMotion) {
            behavior = 'smooth';
        }

        bottomRef.current?.scrollIntoView({ behavior });
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

    const listClassName = joinClasses('auto-scroll-list d-flex column gap-05 flex-1 y-auto', className);

    if (isLoading && items.length === 0) {
        return (
            <div className={joinClasses(listClassName, loadingClassName)} role='status' aria-live='polite' aria-atomic='true'>
                {renderLoading}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className={joinClasses('d-flex flex-center flex-1', className, emptyClassName)} role='status' aria-live='polite' aria-atomic='true'>
                {renderEmpty}
            </div>
        );
    }

    return (
        <div ref={containerRef} className={listClassName} onScroll={handleScroll} role='log' aria-live='polite' aria-relevant='additions text' aria-atomic='false' aria-busy={isLoading} aria-label='Auto-updating content'>
            {hasMore ? loadMoreIndicator : null}
            {items.map((item, index) => (
                <Fragment key={getItemKey ? getItemKey(item, index) : index}>
                    {renderItem(item, index)}
                </Fragment>
            ))}
            {renderAfter}
            <div ref={bottomRef} className='auto-scroll-list-anchor' aria-hidden={hasItems} />
        </div>
    );
};

export default AutoScrollList;
