export interface TrajectoryGLBs{
    trajectory: string;
    defect_mesh: string;
    interface_mesh: string;
    dislocations: string;
    core_atoms: string;
    atoms_colored_by_type: string;
}

export type SceneObjectType = 
    | 'trajectory' 
    | 'dislocations' 
    | 'defect_mesh'
    | 'core_atoms' 
    | 'interface_mesh' 
    | 'atoms_colored_by_type';

export interface ModelData{
    modelBounds?: null,
    glbs: null
}

export interface ModelState{
    activeScene: string;
    activeModel: ModelData | null;
    isModelLoading: boolean;
}

export interface ModelActions{
    selectModel: (glbs: any) => void;
    setGlbsWithoutLoading: (glbs: any) => void; // Nuevo método
    reset: () => void;
    setIsModelLoading: (loading: boolean) => void;
    setModelBounds: (modelBounds: any) => void;
    setActiveScene: (scene: SceneObjectType) => void;
}

export type ModelStore = ModelActions & ModelState;
