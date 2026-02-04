export type PreloadTask = {
    timestep: number;
    analysisId: string;
    model: string;
    score: number;
}

export interface RasterState {
    trajectory: any;
    isLoading: boolean;
    isAnalysisLoading: boolean;
    analyses: Record<string, any>;
    analysesNames: any[];
    selectedAnalysis: string | null;
    error: string | null;

    loadingFrames: Set<string>;
    isPreloading: boolean;
    preloadProgress: number;
    frameCache?: Record<string, string>;
}

export interface RasterActions{
    getRasterFrames: (id: string) => Promise<void>;
    getRasterFrame: (trajectoryId: string, timestep: number, analysisId: string, model: string) => Promise<string | null>;
    preloadAllFrames: (trajectoryId: string) => Promise<void>;
    preloadPriorizedFrames: (
        trajectoryId: string,
        priorityModels: { ml?: string; mr?: string },
        currentTimestep?: number
    ) => Promise<void>;
    getFrameCacheKey: (timestep: number, analysisId: string, model: string) => string;
    clearFrameCache: () => void;

    rasterize?: (id: string) => Promise<void>;
}

export type RasterStore = RasterState & RasterActions;
