import useSocket from './use-socket';
import queryClient from '@/shared/infrastructure/query/query-client';
import { useEffect, useRef } from 'react';
import type { QueryKey } from '@tanstack/react-query';

export interface SocketInvalidationRule<TPayload = unknown> {
    event: string;
    queryKeys: QueryKey[] | ((payload: TPayload) => QueryKey[]);
    matches?: (payload: TPayload) => boolean;
    enabled?: boolean;
};

export interface UseSocketQueryInvalidationOptions {
    debounceMs?: number;
    enabled?: boolean;
};

const DEFAULT_DEBOUNCE_MS = 150;

const useSocketQueryInvalidation = (
    rules: SocketInvalidationRule[],
    options: UseSocketQueryInvalidationOptions = {}
): void => {
    const { debounceMs = DEFAULT_DEBOUNCE_MS, enabled = true } = options;
    const socketService = useSocket();
    const rulesRef = useRef(rules);
    const pendingQueryKeysRef = useRef(new Map<string, QueryKey>());
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    rulesRef.current = rules;

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const scheduleInvalidation = (queryKey: QueryKey): void => {
            pendingQueryKeysRef.current.set(JSON.stringify(queryKey), queryKey);

            if (flushTimerRef.current) {
                return;
            }

            flushTimerRef.current = setTimeout(() => {
                const queryKeys = Array.from(pendingQueryKeysRef.current.values());
                pendingQueryKeysRef.current.clear();
                flushTimerRef.current = null;
                Promise.allSettled(
                    queryKeys.map((currentQueryKey) => queryClient.invalidateQueries({ queryKey: currentQueryKey }))
                );
            }, debounceMs);
        };

        const unsubscribers = rulesRef.current.map((rule, index) => {
            return socketService.on(rule.event, (payload: unknown) => {
                const currentRule = rulesRef.current[index];
                if (!currentRule) return;
                if (currentRule.enabled === false) return;
                if (currentRule.matches && !currentRule.matches(payload)) return;

                const resolvedKeys = typeof currentRule.queryKeys === 'function'
                    ? currentRule.queryKeys(payload)
                    : currentRule.queryKeys;

                resolvedKeys.forEach(scheduleInvalidation);
            });
        });

        return () => {
            if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
            pendingQueryKeysRef.current.clear();
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [socketService, enabled, debounceMs]);
};

export default useSocketQueryInvalidation;
