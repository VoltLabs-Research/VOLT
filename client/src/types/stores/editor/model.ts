export interface TrajectoryGLBs{
    trajectory: string;
    defect_mesh: string;
    interface_mesh: string;
    dislocations: string;
    core_atoms: string;
    atoms_colored_by_type: string;
}

export type SceneObjectType = 
    | { sceneType: string; source: 'default' }
    | { sceneType: string; source: 'plugin'; analysisId: string; exposureId: string };

export interface ModelData{
    modelBounds?: null,
    glbs: null
}

export interface ModelState{
    activeScene: SceneObjectType;
    activeModel: ModelData | null;
    isModelLoading: boolean;
}

export interface ModelActions{
    selectModel: (glbs: any) => void;
    setGlbsWithoutLoading: (glbs: any) => void;
    reset: () => void;
    setIsModelLoading: (loading: boolean) => void;
    setModelBounds: (modelBounds: any) => void;
    setActiveScene: (scene: SceneObjectType) => void;
}

export type ModelStore = ModelActions & ModelState;
