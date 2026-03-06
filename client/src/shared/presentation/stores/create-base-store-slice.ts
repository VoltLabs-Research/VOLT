import { registerSharedAppCleanup } from '@/shared/utils/app-cleanup-registry';
import type { StateCreator } from 'zustand';

export interface BaseSliceState {
    isLoading: boolean;
    error: string | null;
}

export interface BaseSliceActions {
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
    resetBase?: () => void;
}

export type BaseSlice = BaseSliceState & BaseSliceActions;

export const BASE_SLICE_INITIAL_STATE: BaseSliceState = {
    isLoading: false,
    error: null
};

const registeredBaseSliceSetters = new WeakSet<object>();

export const createBaseSlice = <T extends BaseSlice>(
    set: Parameters<StateCreator<T>>[0]
): BaseSlice => ({
    ...(() => {
        const typedSet = set as unknown as object;

        if (!registeredBaseSliceSetters.has(typedSet)) {
            registeredBaseSliceSetters.add(typedSet);
            registerSharedAppCleanup(() => {
                set(BASE_SLICE_INITIAL_STATE as Partial<T>);
            });
        }

        return BASE_SLICE_INITIAL_STATE;
    })(),
    setLoading: (value) => set({ isLoading: value } as Partial<T>),
    setError: (error) => set({ error } as Partial<T>),
    resetBase: () => set(BASE_SLICE_INITIAL_STATE as Partial<T>)
});
