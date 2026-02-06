export const getSceneKey = (sceneConfig: { source: string; sceneType: string; analysisId?: string; exposureId?: string }) => {
    if (sceneConfig.source === 'plugin') {
        return `plugin-${sceneConfig.analysisId}-${sceneConfig.exposureId}`;
    }
    return `${sceneConfig.source}-${sceneConfig.sceneType}`;
};

export const normalizeVec3 = (value?: { x?: number; y?: number; z?: number }) => ({
    x: value?.x ?? 0,
    y: value?.y ?? 0,
    z: value?.z ?? 0
});

export const DEFAULT_SCENE = { sceneType: 'trajectory', source: 'default' };

export const isChartScene = (scene: any, plugins: any[]) => {
    if (scene?.source !== 'plugin') return false;
    const { exposureId } = scene;
    if (!exposureId) return false;

    for (const plugin of plugins) {
        if (!plugin.exposures) continue;
        const exposure = plugin.exposures.find((exposureItem: any) => exposureItem._id === exposureId);
        if (exposure?.export?.type === 'chart-png') {
            return true;
        }
    }
    return false;
};

export const getRenderableScenes = (scenes: any[], plugins: any[], forceDefaultScene: boolean) => {
    if (forceDefaultScene) return [DEFAULT_SCENE];
    return scenes.filter((scene) => !isChartScene(scene, plugins));
};
