import Container from '@/shared/presentation/components/Container';
import { Fragment, useEffect, useRef } from 'react';
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

    useEffect(() => {
        if (items.length > previousItemsLengthRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        previousItemsLengthRef.current = items.length;
    }, [items.length]);

    useEffect(() => {
        if (items.length > 0 && !isLoading) {
            bottomRef.current?.scrollIntoView();
        }
    }, [isLoading, items.length]);

    useEffect(() => {
        if (!autoScrollDependencyEnabled || autoScrollDependency == null) {
            return;
        }

        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [autoScrollDependency, autoScrollDependencyEnabled]);

    const handleScroll = () => {
        if (!containerRef.current || !hasMore || isLoading || !onLoadMore) {
            return;
        }

        if (containerRef.current.scrollTop < loadMoreThreshold) {
            onLoadMore();
        }
    };

    const listClassName = joinClasses('d-flex column gap-05 flex-1 y-auto', className);

    if (isLoading && items.length === 0) {
        return (
            <Container className={joinClasses(listClassName, loadingClassName)}>
                {renderLoading}
            </Container>
        );
    }

    if (items.length === 0) {
        return (
            <Container className={joinClasses('d-flex flex-center flex-1', className, emptyClassName)}>
                {renderEmpty}
            </Container>
        );
    }

    return (
        <Container ref={containerRef} className={listClassName} onScroll={handleScroll}>
            {hasMore ? loadMoreIndicator : null}
            {items.map((item, index) => (
                <Fragment key={getItemKey ? getItemKey(item, index) : index}>
                    {renderItem(item, index)}
                </Fragment>
            ))}
            {renderAfter}
            <Container ref={bottomRef} />
        </Container>
    );
};

export default AutoScrollList;
