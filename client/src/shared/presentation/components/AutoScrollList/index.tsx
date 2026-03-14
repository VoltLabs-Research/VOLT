import Container from '@/shared/presentation/components/Container';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import './AutoScrollList.css';
import { Fragment, useCallback, useEffect, useRef } from 'react';
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
};

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
    autoScrollDependencyEnabled = false
}: AutoScrollListProps<T>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const previousItemsLengthRef = useRef(items.length);
    const prefersReducedMotion = usePrefersReducedMotion();
    const hasItems = items.length > 0;

    const scrollToBottom = useCallback((smooth: boolean) => {
        let behavior: ScrollBehavior = 'auto';

        if (smooth && !prefersReducedMotion) {
            behavior = 'smooth';
        }

        bottomRef.current?.scrollIntoView({ behavior });
    }, [prefersReducedMotion]);

    useEffect(() => {
        if (items.length > previousItemsLengthRef.current) {
            scrollToBottom(true);
        }
        previousItemsLengthRef.current = items.length;
    }, [items.length, scrollToBottom]);

    useEffect(() => {
        if (items.length > 0 && !isLoading) {
            scrollToBottom(false);
        }
    }, [isLoading, items.length, scrollToBottom]);

    useEffect(() => {
        if (!autoScrollDependencyEnabled || autoScrollDependency == null) {
            return;
        }

        scrollToBottom(true);
    }, [autoScrollDependency, autoScrollDependencyEnabled, scrollToBottom]);

    const handleScroll = () => {
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
            <Container
                className={joinClasses(listClassName, loadingClassName)}
                role='status'
                aria-live='polite'
                aria-atomic='true'
            >
                {renderLoading}
            </Container>
        );
    }

    if (items.length === 0) {
        return (
            <Container
                className={joinClasses('d-flex flex-center flex-1', className, emptyClassName)}
                role='status'
                aria-live='polite'
                aria-atomic='true'
            >
                {renderEmpty}
            </Container>
        );
    }

    return (
        <Container
            ref={containerRef}
            className={listClassName}
            onScroll={handleScroll}
            role='log'
            aria-live='polite'
            aria-relevant='additions text'
            aria-atomic='false'
            aria-busy={isLoading}
            aria-label='Auto-updating content'
        >
            {hasMore ? loadMoreIndicator : null}
            {items.map((item, index) => (
                <Fragment key={getItemKey ? getItemKey(item, index) : index}>
                    {renderItem(item, index)}
                </Fragment>
            ))}
            {renderAfter}
            <Container ref={bottomRef} className='auto-scroll-list-anchor' aria-hidden={hasItems} />
        </Container>
    );
};

export default AutoScrollList;
