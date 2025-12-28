import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import type { RasterStore } from '@/types/stores/raster';
import { createRasterSlice } from './raster-slice';

export const useRasterStore = create<RasterStore>()(combineSlices(createRasterSlice));

export default useRasterStore;
