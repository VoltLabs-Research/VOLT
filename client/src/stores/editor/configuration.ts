/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SlicePlaneConfig, ConfigurationStore, ConfigurationState } from '@/types/stores/editor/configuration';

const DEFAULT_SLICE_PLANE_CONFIG: SlicePlaneConfig = {
    normal: { x: 0, y: 0, z: 0 },
    distance: 0,
    slabWidth: 0,
    reverseOrientation: false,
};

const initialState: ConfigurationState = {
    slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG,
    activeSidebarTab: 'Scene',
    activeSidebarOption: '',
    activeModifier: '',
    slicingOrigin: { x: 0, y: 0, z: 0 },
};

const useConfigurationStore = create<ConfigurationStore>()(persist((set, get) => ({
        ...initialState,

        setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => {
            const current = get().slicePlaneConfig;
            const mergedNormal = { ...current.normal, ...(config.normal || {}) };
            const next = {
                normal: mergedNormal,
                distance: typeof config.distance === 'number' ? config.distance : current.distance,
                slabWidth: typeof config.slabWidth === 'number' ? config.slabWidth : current.slabWidth,
                reverseOrientation: typeof config.reverseOrientation === 'boolean' ? config.reverseOrientation : current.reverseOrientation,
            };
            set({ slicePlaneConfig: next });
        },

        setSlicingOrigin: (origin) => {
            set({ slicingOrigin: origin });
        },

        setActiveSidebarOption(option: string){
            set({ activeSidebarOption: option });
        },

        setActiveSidebarTag(tag: string){
            set({ activeSidebarTab: tag });
        },

        setActiveModifier(modifier: string){
            set({ activeModifier: modifier });
        },

        resetSlicePlaneConfig: () => {
            set({ slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG });
        },

        reset: () => {
            set(initialState);
        },
    }),
    {
        name: 'configuration-storage',
        partialize: (state) => ({
            slicePlaneConfig: state.slicePlaneConfig
        }),
    }
));

export default useConfigurationStore;
