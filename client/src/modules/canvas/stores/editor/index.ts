import { createConfigurationSlice } from '../configuration-slice';
import { createCameraSlice } from './camera-slice';
import { createEffectsSlice } from './effects-slice';
import { createLightsSlice } from './lights-slice';
import { createModelSlice } from './model-slice';
import { createOrbitControlsSlice } from './orbit-controls-slice';
import { createPerformanceSlice } from './performance-slice';
import { createPlaybackSlice } from './playback-slice';
import { createRendererSlice } from './renderer-slice';
import { createTimestepSlice } from './timesteps-slice';
import { createVisualSettingsSlice } from './visual-settings-slice';

import { temporal } from 'zundo';
import { create } from 'zustand';

import type { EditorStore } from './types';

const UNDO_HISTORY_LIMIT = 50;
const THROTTLE_DELAY_MS = 500;

export const useEditorStore = create<EditorStore>()(
    temporal(
        (...args) => {
            const [, get] = args;

            return {
                ...createModelSlice(...args),
                ...createPlaybackSlice(...args),
                ...createTimestepSlice(...args),
                ...createCameraSlice(...args),
                ...createLightsSlice(...args),
                ...createOrbitControlsSlice(...args),
                ...createPerformanceSlice(...args),
                ...createRendererSlice(...args),
                ...createConfigurationSlice(...args),
                ...createEffectsSlice(...args),
                ...createVisualSettingsSlice(...args),
                resetAll() {
                    const state = get();

                    state.resetPlayback();
                    state.resetTimesteps();
                    state.resetModel();
                    state.camera.reset();
                    state.lights.reset();
                    state.orbitControls.reset();
                    state.performanceSettings.reset();
                    state.rendererSettings.reset();
                    state.configuration.reset();
                    state.effects.reset();
                    state.grid.reset();
                    state.environment.reset();

                    useEditorStore.temporal.getState().clear();
                }
            };
        },
        {
            partialize: (state) => ({
                camera: {
                    type: state.camera.type,
                    position: state.camera.position,
                    up: state.camera.up,
                    perspective: state.camera.perspective,
                    orthographic: state.camera.orthographic
                },
                lights: {
                    global: state.lights.global,
                    directional: state.lights.directional,
                    point: state.lights.point,
                    spot: state.lights.spot,
                    hemisphere: state.lights.hemisphere,
                    rectArea: state.lights.rectArea
                },
                effects: {
                    ssao: state.effects.ssao,
                    bloom: state.effects.bloom,
                    chromaticAberration: state.effects.chromaticAberration,
                    vignette: state.effects.vignette,
                    depthOfField: state.effects.depthOfField,
                    noise: state.effects.noise,
                    sepia: state.effects.sepia
                },
                grid: {
                    enabled: state.grid.enabled,
                    infiniteGrid: state.grid.infiniteGrid,
                    cellSize: state.grid.cellSize,
                    sectionSize: state.grid.sectionSize,
                    cellThickness: state.grid.cellThickness,
                    sectionThickness: state.grid.sectionThickness,
                    fadeDistance: state.grid.fadeDistance,
                    fadeStrength: state.grid.fadeStrength,
                    sectionColor: state.grid.sectionColor,
                    sectionColorFollowsTheme: state.grid.sectionColorFollowsTheme,
                    cellColor: state.grid.cellColor,
                    cellColorFollowsTheme: state.grid.cellColorFollowsTheme,
                    position: state.grid.position,
                    rotation: state.grid.rotation
                },
                environment: {
                    backgroundColor: state.environment.backgroundColor,
                    backgroundColorFollowsTheme: state.environment.backgroundColorFollowsTheme,
                    enableFog: state.environment.enableFog,
                    fogColor: state.environment.fogColor,
                    fogColorFollowsTheme: state.environment.fogColorFollowsTheme,
                    fogNear: state.environment.fogNear,
                    fogFar: state.environment.fogFar
                },
                orbitControls: {
                    enabled: state.orbitControls.enabled,
                    enableDamping: state.orbitControls.enableDamping,
                    dampingFactor: state.orbitControls.dampingFactor,
                    enableZoom: state.orbitControls.enableZoom,
                    zoomSpeed: state.orbitControls.zoomSpeed,
                    enableRotate: state.orbitControls.enableRotate,
                    rotateSpeed: state.orbitControls.rotateSpeed,
                    enablePan: state.orbitControls.enablePan,
                    panSpeed: state.orbitControls.panSpeed,
                    screenSpacePanning: state.orbitControls.screenSpacePanning,
                    autoRotate: state.orbitControls.autoRotate,
                    autoRotateSpeed: state.orbitControls.autoRotateSpeed,
                    minDistance: state.orbitControls.minDistance,
                    maxDistance: state.orbitControls.maxDistance,
                    minPolarAngle: state.orbitControls.minPolarAngle,
                    maxPolarAngle: state.orbitControls.maxPolarAngle,
                    minAzimuthAngle: state.orbitControls.minAzimuthAngle,
                    maxAzimuthAngle: state.orbitControls.maxAzimuthAngle,
                    target: state.orbitControls.target
                },
                performanceSettings: {
                    preset: state.performanceSettings.preset,
                    dpr: state.performanceSettings.dpr,
                    performance: state.performanceSettings.performance,
                    adaptiveEvents: state.performanceSettings.adaptiveEvents,
                    interactionDegrade: state.performanceSettings.interactionDegrade
                },
                rendererSettings: {
                    create: state.rendererSettings.create,
                    runtime: state.rendererSettings.runtime
                },
                configuration: {
                    slicePlaneConfig: state.configuration.slicePlaneConfig,
                    activeSidebarOption: state.configuration.activeSidebarOption,
                    activeModifier: state.configuration.activeModifier
                },
                pointSizeMultiplier: state.pointSizeMultiplier,
                pointCloudSettings: state.pointCloudSettings,
                sceneVisualOverrides: state.sceneVisualOverrides,
                showSimulationCell: state.showSimulationCell
            }),
            limit: UNDO_HISTORY_LIMIT,
            handleSet: (handleSet) => {
                let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

                return (state) => {
                    if (pendingTimeout) {
                        clearTimeout(pendingTimeout);
                    }

                    pendingTimeout = setTimeout(() => {
                        handleSet(state);
                        pendingTimeout = null;
                    }, THROTTLE_DELAY_MS);
                };
            }
        }
    )
);
