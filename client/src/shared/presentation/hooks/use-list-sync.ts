import { useEffect, useRef, useCallback } from 'react';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';

type SyncAction = 'created' | 'deleted' | 'updated';

export interface ListSyncEventConfig {
    /** Socket event name, e.g. 'trajectory.created' */
    event: string;
    /** What kind of mutation this event represents */
    action: SyncAction;
    /**
     * Extract the document _id from the socket payload.
     * For 'deleted' events this is used to filter the item out.
     * For 'created'/'updated' events this identifies the target item.
     * Defaults to payload => payload._id
     */
    getId?: (payload: any) => string;
    /**
     * For 'created' events: transform the socket payload into the shape
     * expected by the list. If omitted, a full refetch is triggered instead
     * (since the socket payload may not carry the full display-ready object).
     */
    toItem?: (payload: any) => any;
    /**
     * For 'updated' events: extract partial fields to merge into the existing item.
     * Defaults to returning the full payload.
     */
    toPartial?: (payload: any) => Partial<any>;
}

export interface ListSyncConfig {
    events: ListSyncEventConfig[];
    /** Whether sync is active (defaults to true) */
    enabled?: boolean;
}

interface UseListSyncOptions<T> {
    config: ListSyncConfig | undefined;
    setData: React.Dispatch<React.SetStateAction<T[]>>;
    refresh: () => void;
}

/**
 * Generic hook that subscribes to socket CRUD events and surgically
 * patches a paginated list's data state.
 *
 * - `created` → prepend item (if `toItem` provided) or trigger full refresh
 * - `deleted` → filter item out by `_id`
 * - `updated` → merge partial update into matching item
 */
const useListSync = <T extends { _id: string }>(options: UseListSyncOptions<T>): void => {
    const { config, setData, refresh } = options;
    const socketService = useSocket();

    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;

    const setDataRef = useRef(setData);
    setDataRef.current = setData;

    const handleCreated = useCallback((eventConfig: ListSyncEventConfig, payload: any) => {
        if (eventConfig.toItem) {
            const newItem = eventConfig.toItem(payload) as T;
            setDataRef.current((prev) => {
                // Avoid duplicates
                if (prev.some((item) => item._id === newItem._id)) return prev;
                return [newItem, ...prev];
            });
        } else {
            // No toItem transformer — trigger a full refresh so the list
            // picks up the new item with proper server-side formatting.
            refreshRef.current();
        }
    }, []);

    const handleDeleted = useCallback((eventConfig: ListSyncEventConfig, payload: any) => {
        const getId = eventConfig.getId ?? ((p: any) => p._id);
        const deletedId = getId(payload);
        if (!deletedId) return;

        setDataRef.current((prev) => prev.filter((item) => item._id !== deletedId));
    }, []);

    const handleUpdated = useCallback((eventConfig: ListSyncEventConfig, payload: any) => {
        const getId = eventConfig.getId ?? ((p: any) => p._id);
        const targetId = getId(payload);
        if (!targetId) return;

        const partial = eventConfig.toPartial
            ? eventConfig.toPartial(payload)
            : payload;

        setDataRef.current((prev) =>
            prev.map((item) =>
                item._id === targetId ? { ...item, ...partial } : item
            )
        );
    }, []);

    useEffect(() => {
        if (!config?.events?.length || config.enabled === false) return;

        const unsubscribers: (() => void)[] = [];

        for (const eventConfig of config.events) {
            const handler = (payload: any) => {
                switch (eventConfig.action) {
                    case 'created':
                        handleCreated(eventConfig, payload);
                        break;
                    case 'deleted':
                        handleDeleted(eventConfig, payload);
                        break;
                    case 'updated':
                        handleUpdated(eventConfig, payload);
                        break;
                }
            };

            const unsubscribe = socketService.on(
                eventConfig.event,
                handler as (...args: unknown[]) => void
            );
            unsubscribers.push(unsubscribe);
        }

        return () => {
            for (const unsub of unsubscribers) {
                unsub();
            }
        };
    }, [config, socketService, handleCreated, handleDeleted, handleUpdated]);
};

export default useListSync;
