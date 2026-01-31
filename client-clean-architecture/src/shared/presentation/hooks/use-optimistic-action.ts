import { useState, useCallback } from 'react';
import type { MenuOption } from '@/shared/presentation/components/DocumentListingTable';
import { extractItemKey } from '@/shared/utils/keys';

interface UseOptimisticActionOptions {
    shouldTrack?: (option: MenuOption) => boolean;
};

interface UseOptimisticActionReturn<T> {
    optimisticallyHiddenIds: Set<string>;
    wrapMenuOptions: (item: T, options: MenuOption[]) => MenuOption[];
    filterVisibleData: (data: T[]) => T[];
};

const useOptimisticAction = <T>({
    shouldTrack = (opt) => opt.destructive === true
}: UseOptimisticActionOptions = {}): UseOptimisticActionReturn<T> => {
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

    const addToHidden = useCallback((id: string) => {
        setHiddenIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    const removeFromHidden = useCallback((id: string) => {
        setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const wrapAction = useCallback((item: T, action: () => void | Promise<void>) => {
        return async () => {
            const id = String(extractItemKey(item, 0));
            addToHidden(id);

            try {
                await action();
            } catch (err) {
                removeFromHidden(id);
                throw err;
            }
        };
    }, [addToHidden, removeFromHidden]);

    const wrapMenuOptions = useCallback((item: T, options: MenuOption[]) => {
        return options.map((opt) =>
            shouldTrack(opt)
                ? { ...opt, onClick: wrapAction(item, opt.onClick) }
                : opt
        );
    }, [shouldTrack, wrapAction]);

    const filterVisibleData = useCallback((data: T[]) => {
        return data.filter((item, idx) =>
            !hiddenIds.has(String(extractItemKey(item, idx)))
        );
    }, [hiddenIds]);

    return {
        optimisticallyHiddenIds: hiddenIds,
        wrapMenuOptions,
        filterVisibleData
    };
};

export default useOptimisticAction;
