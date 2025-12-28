import type { StateCreator } from 'zustand';

export type SliceCreator<TSlice, TFullState = TSlice> = StateCreator<TFullState, [], [], TSlice>;

export function combineSlices<TState extends object>(...slices: SliceCreator<Partial<TState>, TState>[]): StateCreator<TState> {
    return (set, get, store) => {
        const combined = {} as TState;
        for (const createSlice of slices) Object.assign(combined, createSlice(set, get, store));
        return combined;
    };
}