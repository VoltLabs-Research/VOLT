import { create } from 'zustand';
import { createRasterSlice } from './slice';
import type { RasterSlice } from './slice';

export const useRasterStore = create<RasterSlice>()((...a) => ({
    ...createRasterSlice(...a)
}));

export * from './slice';
