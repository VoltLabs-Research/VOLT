export interface ModifiersState{
    isAnalysisLoading: boolean;
    error: string | null;
    isRenderOptionsLoading: boolean;
    isLoading: boolean;
}

export interface ModifiersActions{
    structureIdentification(id: string, analysisConfig: any, identificationMode: string): Promise<void>;
    computeAnalyses(id: string): Promise<void>;
    dislocationAnalysis(trajectoryId: string, analysisConfig: any): Promise<void>;
    dislocationRenderOptions(trajectoryId: string, timestep: string, analysisId: string, options: any): Promise<void>;
}

export type ModifiersStore = ModifiersState & ModifiersActions;