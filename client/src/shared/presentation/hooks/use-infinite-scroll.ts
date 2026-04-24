import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface UseInfiniteScrollOptions {
    rootRef?: RefObject<HTMLElement | null> | null;
    hasMore: boolean;
    isFetchingMore: boolean;
    onLoadMore?: () => void;
};

const useInfiniteScroll = ({ rootRef, hasMore, isFetchingMore, onLoadMore }: UseInfiniteScrollOptions) => {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const hasMountedRef = useRef(false);
    const onLoadMoreRef = useRef(onLoadMore);

    useEffect(() => {
        onLoadMoreRef.current = onLoadMore;
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            hasMountedRef.current = true;
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const root = rootRef ? rootRef.current : null;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (
                    entry?.isIntersecting
                    && hasMore
                    && !isFetchingMore
                    && hasMountedRef.current
                ) {
                    onLoadMoreRef.current?.();
                }
            },
            { root, rootMargin: '0px 0px 200px 0px', threshold: 0 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [rootRef, hasMore, isFetchingMore]);

    return { sentinelRef };
};

export default useInfiniteScroll;
