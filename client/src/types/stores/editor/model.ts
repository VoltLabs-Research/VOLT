export interface TrajectoryGLBs {
    trajectory: string;
    defect_mesh: string;
    interface_mesh: string;
    dislocations: string;
    core_atoms: string;
    atoms_colored_by_type: string;
}

export type DefaultScene = {
    sceneType: string;
    source: 'default';
};

export type PluginScene = {
    sceneType: string;
    source: 'plugin';
    analysisId: string;
    exposureId: string;
};

export type ColorCodingScene = {
    sceneType: string;
    source: 'color-coding';
    analysisId: string;
    exposureId: string;
    property: string;
    startValue: string;
    endValue: string;
    gradient: string;
};

export type SceneObjectType = DefaultScene | PluginScene | ColorCodingScene;

export interface ModelData {
    modelBounds?: null,
    glbs: null
}

export type ActiveScene = SceneObjectType;

export interface ModelState {
    activeScene: SceneObjectType;
    activeScenes: ActiveScene[];
    activeModel: ModelData | null;
    isModelLoading: boolean;
}

export interface ModelActions {
    selectModel: (glbs: any) => void;
    setGlbsWithoutLoading: (glbs: any) => void;
    resetModel: () => void;
    setIsModelLoading: (loading: boolean) => void;
    setModelBounds: (modelBounds: any) => void;
    setActiveScene: (scene: SceneObjectType) => void;
    addScene: (scene: SceneObjectType) => void;
    removeScene: (scene: SceneObjectType) => void;
    toggleScene: (scene: SceneObjectType) => void;
}

export type ModelStore = ModelActions & ModelState;
