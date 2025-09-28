import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type CameraConfigStore, CAMERA_ADVANCED_DEFAULT } from '@/types/stores/editor/camera-config';

const useCameraConfigStore = create<CameraConfigStore>()(persist((set) => ({
    ...CAMERA_ADVANCED_DEFAULT,

    setFov: (value: number) => {
        set({ fov: value });
    },

    setNear: (value: number) => {
        set({ near: value });
    },

    setFar: (value: number) => {
        set({ far: value });
    },

    setZoom: (value: number) => {
        set({ zoom: value });
    },

    setFilmGauge: (value: number) => {
        set({ filmGauge: value });
    },

    setFilmOffset: (value: number) => {
        set({ filmOffset: value });
    },

    setFocus: (value: number) => {
        set({ focus: value });
    },

    setAspect: (value: number) => {
        set({ aspect: value });
    },

    setEnableAutoFocus: (value: boolean) => {
        set({ enableAutoFocus: value });
    },

    setAutoFocusSpeed: (value: number) => {
        set({ autoFocusSpeed: value });
    },

    setBokehScale: (value: number) => {
        set({ bokehScale: value });
    },

    setMaxBlur: (value: number) => {
        set({ maxBlur: value });
    },

    reset: () => {
        set(CAMERA_ADVANCED_DEFAULT);
    }
}), { name: 'camera-config-state' }));

export default useCameraConfigStore;