import { isSameScene, isTimestepScopedScene } from '@/modules/canvas/utils/scene-identity';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_SCENE, getSceneKey } from '@/modules/fractal/utils/scene-utils';
import { areModelWorldBoundsEqual } from '@/modules/fractal/utils/model-world-bounds';

import type { EditorStore } from './types';
import type { ModelLoadingState } from '@/modules/fractal/contracts/model';
import type { ModelWorldBounds } from '@/modules/fractal/contracts/model';
import {
    PointCloudDetailLevel,
    PointCloudStyleMode
} from '@/modules/fractal/contracts/editor/scene-types';

import type { ModelStore, ModelState, PointCloudSettingsState, ModelData, ModelDragOffset, ViewportPane } from '@/modules/fractal/contracts/editor/scene-types';
import type { SceneObjectType, SceneVisualOverride } from '@/modules/fractal/contracts/scene';
import type { StateCreator } from 'zustand';

export const MAX_VIEWPORT_PANES = 4;

const createDefaultPane = (scenes: SceneObjectType[] = [DEFAULT_SCENE], mergeGroups: Record<string, string> = {}): ViewportPane => ({
    id: uuidv4(),
    scenes,
    mergeGroups,
    analysisId: scenes.find((scene) => scene.source === 'plugin')?.analysisId
});

const syncFocusedPane = (
    panes: ViewportPane[],
    focusedPaneId: string,
    scenes: SceneObjectType[],
    mergeGroups: Record<string, string>
): ViewportPane[] => {
    return panes.map((pane) => {
        if (pane.id !== focusedPaneId) {
            return pane;
        }

        return {
            ...pane,
            scenes,
            mergeGroups,
            analysisId: scenes.find((scene) => scene.source === 'plugin')?.analysisId ?? pane.analysisId
        };
    });
};

const POINT_CLOUD_SETTINGS_INITIAL: PointCloudSettingsState = {
    overridesEnabled: false,
    detailLevel: PointCloudDetailLevel.Auto,
    useSceneOpacity: true,
    style: PointCloudStyleMode.Softened
};

const areSceneListsEqual = (left: SceneObjectType[], right: SceneObjectType[]): boolean => {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((scene, index) => isSameScene(scene, right[index]));
};

const getSceneStateWithoutTimestepScopedScenes = (state: ModelState): Pick<ModelState, 'activeScene' | 'activeScenes'> | null => {
    const activeScenes = state.activeScenes.filter((scene) => !isTimestepScopedScene(scene));
    const nextActiveScenes = activeScenes.length > 0 ? activeScenes : [DEFAULT_SCENE];
    const nextActiveScene = isTimestepScopedScene(state.activeScene)
        ? nextActiveScenes[0]
        : state.activeScene;

    const didChangeActiveScene = !isSameScene(state.activeScene, nextActiveScene);
    const didChangeActiveScenes = !areSceneListsEqual(state.activeScenes, nextActiveScenes);

    if (!didChangeActiveScene && !didChangeActiveScenes) {
        return null;
    }

    return {
        activeScene: nextActiveScene,
        activeScenes: nextActiveScenes
    };
};

const getSceneKeysInMergeGroup = (
    mergeGroups: Record<string, string>,
    groupId: string
): string[] => Object.keys(mergeGroups).filter((key) => mergeGroups[key] === groupId);

const withSceneRemovedFromMergeGroups = (
    mergeGroups: Record<string, string>,
    sceneKey: string
): Record<string, string> | null => {
    const groupId = mergeGroups[sceneKey];
    if (!groupId) {
        return null;
    }

    const nextMergeGroups = { ...mergeGroups };
    delete nextMergeGroups[sceneKey];

    const remainingKeys = getSceneKeysInMergeGroup(nextMergeGroups, groupId);
    if (remainingKeys.length < 2) {
        remainingKeys.forEach((key) => {
            delete nextMergeGroups[key];
        });
    }

    return nextMergeGroups;
};

const createInitialState = (): ModelState => {
    const defaultPane = createDefaultPane();
    return {
        activeModel: null,
    activeScene: DEFAULT_SCENE,
    activeScenes: [DEFAULT_SCENE],
    viewportPanes: [defaultPane],
    focusedViewportPaneId: defaultPane.id,
    isModelLoading: false,
    pointSizeMultiplier: 1.0,
    pointCloudSettings: POINT_CLOUD_SETTINGS_INITIAL,
    sceneVisualOverrides: {},
    sceneLoadStates: {},
    modelWorldBounds: null,
    modelDragOffsets: {},
    sceneMergeGroups: {},
    showSimulationCell: true,
        isPointCloudScene: false
    };
};

export const createModelSlice: StateCreator<EditorStore, [], [], ModelStore> = (set, get) => ({
    ...createInitialState(),

    setActiveScene(scene: SceneObjectType) {
        set((state) => {
            const nextScenes = [scene];
            return {
                activeScene: scene,
                activeScenes: nextScenes,
                viewportPanes: syncFocusedPane(state.viewportPanes, state.focusedViewportPaneId, nextScenes, {})
            };
        });
    },

    clearTimestepScopedScenes() {
        set((state) => {
            return getSceneStateWithoutTimestepScopedScenes(state) ?? state;
        });
    },

    addScene(scene: SceneObjectType) {
        set((state) => {
            const exists = state.activeScenes.some(s => isSameScene(s, scene));
            if (exists) return state;
            const nextScenes = [...state.activeScenes, scene];
            return {
                activeScenes: nextScenes,
                viewportPanes: syncFocusedPane(
                    state.viewportPanes,
                    state.focusedViewportPaneId,
                    nextScenes,
                    state.sceneMergeGroups
                )
            };
        });
    },

    setActiveScenes(scenes: SceneObjectType[]) {
        set((state) => {
            return {
                activeScene: scenes[0] ?? DEFAULT_SCENE,
                activeScenes: scenes,
                viewportPanes: syncFocusedPane(
                    state.viewportPanes,
                    state.focusedViewportPaneId,
                    scenes,
                    state.sceneMergeGroups
                )
            };
        });
    },

    setComposedScenes(scenes: SceneObjectType[]) {
        const nextScenes = scenes.length > 0 ? scenes : [DEFAULT_SCENE];
        const nextMergeGroups: Record<string, string> = {};
        if (nextScenes.length > 1) {
            const groupId = uuidv4();
            nextScenes.forEach((scene) => {
                nextMergeGroups[getSceneKey(scene)] = groupId;
            });
        }

        set((state) => ({
            activeScene: nextScenes[0],
            activeScenes: nextScenes,
            sceneMergeGroups: nextMergeGroups,
            modelDragOffsets: {},
            viewportPanes: syncFocusedPane(
                state.viewportPanes,
                state.focusedViewportPaneId,
                nextScenes,
                nextMergeGroups
            )
        }));
    },

    removeScene(scene: SceneObjectType) {
        set((state) => {
            const removedKey = getSceneKey(scene);
            const nextOffsets = { ...state.modelDragOffsets };
            delete nextOffsets[removedKey];
            const nextScenes = state.activeScenes.filter(s => !isSameScene(s, scene));
            const nextMergeGroups = withSceneRemovedFromMergeGroups(state.sceneMergeGroups, removedKey)
                ?? state.sceneMergeGroups;

            return {
                activeScenes: nextScenes,
                modelDragOffsets: nextOffsets,
                sceneMergeGroups: nextMergeGroups,
                viewportPanes: syncFocusedPane(
                    state.viewportPanes,
                    state.focusedViewportPaneId,
                    nextScenes,
                    nextMergeGroups
                )
            };
        });
    },

    setModelBounds(modelBounds: ModelData['modelBounds']) {
        const { activeModel } = get();
        if (!activeModel) return;

        set({
            activeModel: {
                ...activeModel,
                modelBounds
            }
        });
    },

    setModelWorldBounds(bounds: ModelWorldBounds | null) {
        set((state) => {
            if (areModelWorldBoundsEqual(state.modelWorldBounds, bounds)) {
                return state;
            }

            return { modelWorldBounds: bounds };
        });
    },

    setModelLoadingState(loadingState: ModelLoadingState) {
        set({ isModelLoading: loadingState.isLoading });
    },

    resetModel() {
        set(createInitialState());
    },

    setPointSizeMultiplier(multiplier: number) {
        set({ pointSizeMultiplier: Math.max(0.1, Math.min(5.0, multiplier)) });
    },

    increasePointSize() {
        set((state) => ({
            pointSizeMultiplier: Math.min(5.0, state.pointSizeMultiplier + 0.1)
        }));
    },

    decreasePointSize() {
        set((state) => ({
            pointSizeMultiplier: Math.max(0.1, state.pointSizeMultiplier - 0.1)
        }));
    },

    setSceneOpacity(sceneKey: string, opacity: number) {
        const nextOpacity = Math.max(0, Math.min(1, opacity));

        set((state) => ({
            sceneVisualOverrides: {
                ...state.sceneVisualOverrides,
                [sceneKey]: {
                    ...state.sceneVisualOverrides[sceneKey],
                    opacity: nextOpacity
                }
            }
        }));
    },

    setSceneLineWidth(sceneKey: string, lineWidth: number) {
        const nextLineWidth = Number.isFinite(lineWidth)
            ? Math.max(0.01, lineWidth)
            : 0.01;

        set((state) => ({
            sceneVisualOverrides: {
                ...state.sceneVisualOverrides,
                [sceneKey]: {
                    ...state.sceneVisualOverrides[sceneKey],
                    lineWidth: nextLineWidth
                }
            }
        }));
    },

    setSceneColor(sceneKey: string, color: string | undefined) {
        set((state) => ({
            sceneVisualOverrides: {
                ...state.sceneVisualOverrides,
                [sceneKey]: {
                    ...state.sceneVisualOverrides[sceneKey],
                    color
                }
            }
        }));
    },

    setSceneEdges(sceneKey: string, edges: boolean) {
        set((state) => ({
            sceneVisualOverrides: {
                ...state.sceneVisualOverrides,
                [sceneKey]: {
                    ...state.sceneVisualOverrides[sceneKey],
                    edges
                }
            }
        }));
    },

    applySceneVisualOverride(sceneKey: string, override: SceneVisualOverride) {
        set((state) => ({
            sceneVisualOverrides: {
                ...state.sceneVisualOverrides,
                [sceneKey]: {
                    ...state.sceneVisualOverrides[sceneKey],
                    ...override
                }
            }
        }));
    },

    setSceneLoadingState(sceneKey: string, loadingState: ModelLoadingState) {
        set((state) => {
            const current = state.sceneLoadStates[sceneKey];
            if (
                current
                && current.isLoading === loadingState.isLoading
                && current.progress === loadingState.progress
                && current.error === loadingState.error
            ) {
                return state;
            }

            return {
                sceneLoadStates: {
                    ...state.sceneLoadStates,
                    [sceneKey]: loadingState
                }
            };
        });
    },

    setShowSimulationCell(show: boolean) {
        set({ showSimulationCell: show });
    },

    setIsPointCloudScene(isPointCloud: boolean) {
        set((state) => {
            if (state.isPointCloudScene === isPointCloud) return state;
            return { isPointCloudScene: isPointCloud };
        });
    },

    setModelDragOffsetForScene(sceneKey: string, offset: ModelDragOffset) {
        set((state) => {
            const current = state.modelDragOffsets[sceneKey];
            if (current && current.x === offset.x && current.y === offset.y && current.z === offset.z) {
                return state;
            }

            return {
                modelDragOffsets: {
                    ...state.modelDragOffsets,
                    [sceneKey]: offset
                }
            };
        });
    },

    mergeScenes(sceneKeys: string[]) {
        if (sceneKeys.length < 2) return;

        set((state) => {
            const joinedGroupIds = new Set(
                sceneKeys
                    .map((sceneKey) => state.sceneMergeGroups[sceneKey])
                    .filter((groupId): groupId is string => Boolean(groupId))
            );
            const groupId = joinedGroupIds.values().next().value ?? uuidv4();
            const nextMergeGroups = { ...state.sceneMergeGroups };

            for (const [key, currentGroupId] of Object.entries(nextMergeGroups)) {
                if (joinedGroupIds.has(currentGroupId)) {
                    nextMergeGroups[key] = groupId;
                }
            }

            sceneKeys.forEach((sceneKey) => {
                nextMergeGroups[sceneKey] = groupId;
            });

            return {
                sceneMergeGroups: nextMergeGroups,
                viewportPanes: syncFocusedPane(
                    state.viewportPanes,
                    state.focusedViewportPaneId,
                    state.activeScenes,
                    nextMergeGroups
                )
            };
        });
    },

    unmergeScene(sceneKey: string) {
        set((state) => {
            const nextMergeGroups = withSceneRemovedFromMergeGroups(state.sceneMergeGroups, sceneKey);
            if (!nextMergeGroups) {
                return state;
            }

            return {
                sceneMergeGroups: nextMergeGroups,
                viewportPanes: syncFocusedPane(
                    state.viewportPanes,
                    state.focusedViewportPaneId,
                    state.activeScenes,
                    nextMergeGroups
                )
            };
        });
    },

    addViewportPane() {
        const state = get();
        if (state.viewportPanes.length >= MAX_VIEWPORT_PANES) {
            return false;
        }

        const pane = createDefaultPane([], {});
        set({
            viewportPanes: [...state.viewportPanes, pane],
            focusedViewportPaneId: pane.id,
            activeScene: DEFAULT_SCENE,
            activeScenes: [],
            sceneMergeGroups: {}
        });
        return true;
    },

    focusViewportPane(paneId: string) {
        set((state) => {
            const pane = state.viewportPanes.find((candidate) => candidate.id === paneId);
            if (!pane || pane.id === state.focusedViewportPaneId) {
                return state;
            }

            return {
                focusedViewportPaneId: pane.id,
                activeScene: pane.scenes[0] ?? DEFAULT_SCENE,
                activeScenes: pane.scenes,
                sceneMergeGroups: pane.mergeGroups
            };
        });
    },

    closeViewportPane(paneId: string) {
        set((state) => {
            if (state.viewportPanes.length <= 1) {
                return state;
            }

            const nextPanes = state.viewportPanes.filter((pane) => pane.id !== paneId);
            if (nextPanes.length === state.viewportPanes.length) {
                return state;
            }

            const nextFocused = state.focusedViewportPaneId === paneId
                ? nextPanes[0]
                : nextPanes.find((pane) => pane.id === state.focusedViewportPaneId) ?? nextPanes[0];

            return {
                viewportPanes: nextPanes,
                focusedViewportPaneId: nextFocused.id,
                activeScene: nextFocused.scenes[0] ?? DEFAULT_SCENE,
                activeScenes: nextFocused.scenes,
                sceneMergeGroups: nextFocused.mergeGroups
            };
        });
    }
});
