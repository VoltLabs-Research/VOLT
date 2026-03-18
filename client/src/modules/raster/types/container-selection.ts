import type { DefaultScene, PluginScene } from '@/modules/fractal/api/entities/scene';

export type RasterContainerId = 'container-1' | 'container-2';

export type RasterSelectableScene = DefaultScene | PluginScene;

export interface RasterContainerSelection {
    id: RasterContainerId;
    title: string;
    label: string;
    scene: RasterSelectableScene;
    model?: string;
};

export const DEFAULT_RASTER_SCENE: DefaultScene = {
    sceneType: 'trajectory',
    source: 'default'
};

const CONTAINER_TITLES: Record<RasterContainerId, string> = {
    'container-1': 'Container 1',
    'container-2': 'Container 2'
};

export const createDefaultRasterContainerSelection = (containerId: RasterContainerId): RasterContainerSelection => {
    return {
        id: containerId,
        title: CONTAINER_TITLES[containerId],
        label: 'Trajectory',
        scene: DEFAULT_RASTER_SCENE
    };
};

export const createInitialRasterContainerSelections = (): RasterContainerSelection[] => {
    return [
        createDefaultRasterContainerSelection('container-1'),
        createDefaultRasterContainerSelection('container-2')
    ];
};
