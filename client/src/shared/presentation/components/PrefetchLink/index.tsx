import { usePrefetch } from '@/shared/presentation/hooks/use-prefetch';
import type { ReactNode } from 'react';

interface PrefetchLinkProps {
    /** The route path to prefetch data for on hover. */
    prefetchPath: string;
    children: ReactNode;
};

/**
 * Wraps children in a transparent `<div>` that triggers data prefetching
 * on mouse enter for the given route path. Does nothing if no prefetch
 * factory is registered for the path.
 */
const PrefetchLink = ({ prefetchPath, children }: PrefetchLinkProps) => {
    const { onMouseEnter, onMouseLeave } = usePrefetch(prefetchPath);

    return (
        <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            {children}
        </div>
    );
};

export default PrefetchLink;
