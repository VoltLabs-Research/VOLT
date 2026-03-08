import { useState, useCallback } from 'react';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface Identifiable {
    _id: string;
};

interface UseOptimisticActionOptions {
    shouldTrack?: (option: MenuOption) => boolean;
};

interface UseOptimisticActionReturn<T> {
    optimisticallyHiddenIds: Set<string>;
    addToHidden: (id: string) => void;
    wrapMenuOptions: (item: T, targetItems: T[], options: MenuOption[]) => MenuOption[];
    filterVisibleData: (data: T[]) => T[];
};

const useOptimisticAction = <T extends Identifiable>({
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

    const addManyToHidden = useCallback((ids: string[]) => {
        if (!ids.length) return;
        setHiddenIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            return next;
        });
    }, []);

    const removeManyFromHidden = useCallback((ids: string[]) => {
        if (!ids.length) return;
        setHiddenIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
        });
    }, []);

    const wrapAction = useCallback((targetItems: T[], action: () => void | Promise<void>) => {
        return async () => {
            const targetIds = targetItems.map((item) => item._id);

            addManyToHidden(targetIds);

            try {
                await action();
            } catch (err) {
                removeManyFromHidden(targetIds);
                throw err;
            }
        };
    }, [addManyToHidden, removeManyFromHidden]);

    const wrapMenuOptions = useCallback((item: T, targetItems: T[], options: MenuOption[]) => {
        return options.map((opt) =>
            shouldTrack(opt)
                ? { ...opt, onClick: wrapAction(targetItems.length ? targetItems : [item], opt.onClick) }
                : opt
        );
    }, [shouldTrack, wrapAction]);

    const filterVisibleData = useCallback((data: T[]) => {
        if (!data) return [];
        return data.filter((item) => !hiddenIds.has(item._id));
    }, [hiddenIds]);

    return {
        optimisticallyHiddenIds: hiddenIds,
        addToHidden,
        wrapMenuOptions,
        filterVisibleData
    };
};

export default useOptimisticAction;
