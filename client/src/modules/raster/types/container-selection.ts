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

export const createInitialRasterContainerSelections = (): RasterContainerSelection[] => {
    return [
        {
            id: 'container-1',
            title: 'Container 1',
            label: 'Trajectory',
            scene: DEFAULT_RASTER_SCENE
        },
        {
            id: 'container-2',
            title: 'Container 2',
            label: 'Trajectory',
            scene: DEFAULT_RASTER_SCENE
        }
    ];
};
