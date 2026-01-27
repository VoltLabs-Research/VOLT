export interface ChangeTimestepRequest {
    newTimestep: number;
    currentTimestep?: number;
    trajectoryId: string;
}

export interface ChangeTimestepResponse {
    shouldUpdate: boolean;
    timestep: number;
}

/**
 * Use Case to handle timestep changes.
 */
export class ChangeTimestepUseCase {
    execute(request: ChangeTimestepRequest): ChangeTimestepResponse {
        const { newTimestep, currentTimestep, trajectoryId } = request;

        // If the timestep is the same, no need to update
        if (newTimestep === currentTimestep) {
            return { shouldUpdate: false, timestep: newTimestep };
        }

        // Logic check: ensure trajectoryId exists
        if (!trajectoryId) {
            return { shouldUpdate: false, timestep: currentTimestep ?? newTimestep };
        }

        // Potential logic: clip timestep to trajectory bounds (if we had them here, 
        // but trajectory object is not in request to keep it light. 
        // Presentation layer or another usecase can handle bounds).

        return {
            shouldUpdate: true,
            timestep: newTimestep
        };
    }
}
