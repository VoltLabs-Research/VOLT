import { useCallback, useRef } from 'react';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { getPrefetchFactory } from '@/shared/infrastructure/query/prefetch/registry';
import queryClient from '@/shared/infrastructure/query/query-client';
import type { PrefetchContext } from '@/shared/infrastructure/query/prefetch/types';

const DEBOUNCE_MS = 80;

/**
 * Returns a pair of handlers `{ onMouseEnter, onMouseLeave }` that
 * trigger prefetching for the given route path on hover.
 *
 * Debounces by 80 ms to avoid firing on accidental cursor pass-throughs.
 * Reads `selectedTeamId` synchronously from Zustand to build team-scoped queries.
 *
 * @param path - The route path whose registered prefetch factory should be invoked.
 */
export const usePrefetch = (path: string) => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onMouseEnter = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            const factory = getPrefetchFactory(path);
            if (!factory) return;

            const teamId = useTeamStore.getState().selectedTeamId;
            const ctx: PrefetchContext = { teamId };
            const targets = factory(ctx);

            for (const target of targets) {
                queryClient.prefetchQuery({
                    queryKey: target.queryKey,
                    queryFn: target.queryFn,
                    staleTime: target.staleTime
                });
            }
        }, DEBOUNCE_MS);
    }, [path]);

    const onMouseLeave = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    return { onMouseEnter, onMouseLeave };
};
