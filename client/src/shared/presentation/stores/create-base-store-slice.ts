import type { StateCreator } from 'zustand';

export interface BaseSliceState {
    isLoading: boolean;
    error: string | null;
}

export interface BaseSliceActions {
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
}

export type BaseSlice = BaseSliceState & BaseSliceActions;

export const BASE_SLICE_INITIAL_STATE: BaseSliceState = {
    isLoading: false,
    error: null
};

export const createBaseSlice = <T extends BaseSlice>(
    set: Parameters<StateCreator<T>>[0]
): BaseSlice => ({
    ...BASE_SLICE_INITIAL_STATE,
    setLoading: (value) => set({ isLoading: value } as Partial<T>),
    setError: (error) => set({ error } as Partial<T>)
});

