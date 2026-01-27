export interface HandleAnalysisChangeRequest {
    analysisId?: string;
    previousAnalysisId?: string;
    currentTimestep?: number;
}

export interface HandleAnalysisChangeResponse {
    shouldResetModel: boolean;
    shouldRecomputeData: boolean;
    timestamp?: number;
}

/**
 * Use Case to handle changes in the active analysis configuration.
 * Determines if a model needs to be reloaded.
 */
export class HandleAnalysisChangeUseCase {
    execute(request: HandleAnalysisChangeRequest): HandleAnalysisChangeResponse {
        const { analysisId, previousAnalysisId, currentTimestep } = request;

        // If no analysis is active, or if it hasn't changed, do nothing
        if (!analysisId || analysisId === previousAnalysisId) {
            return {
                shouldResetModel: false,
                shouldRecomputeData: false
            };
        }

        // If analysis changed and we have a valid timestep, force a reload
        if (currentTimestep !== undefined) {
            return {
                shouldResetModel: true,
                shouldRecomputeData: true,
                timestamp: Date.now() // Force cache break
            };
        }

        return {
            shouldResetModel: true,
            shouldRecomputeData: false
        };
    }
}
