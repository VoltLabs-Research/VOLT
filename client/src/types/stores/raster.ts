/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

interface AnalysisName {
    _id: string;
    name: string;
    description?: string;
    RMSD?: number;
    maxTrialCircuitSize?: number;
    circuitStretchability?: number;
    identificationMode?: string;
}

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
    analysesNames: AnalysisName[];
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