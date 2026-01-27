import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import type { AnalysisConfig } from '@/modules/analysis/domain/entities/Analysis';

export interface InitializeTrajectoryRequest {
    trajectory: Trajectory;
    currentTimestep?: number;
}

export interface InitializeTrajectoryResponse {
    initialTimestep?: number;
    initialAnalysisConfig?: AnalysisConfig;
}

/**
 * Use Case to initialize the canvas state for a given trajectory.
 * Decides which timestep and analysis config should be active initially.
 */
export class InitializeTrajectoryUseCase {
    execute(request: InitializeTrajectoryRequest): InitializeTrajectoryResponse {
        const { trajectory, currentTimestep } = request;
        const response: InitializeTrajectoryResponse = {};

        // 1. Determine initial timestep if not already set
        if (currentTimestep === undefined && trajectory.frames && trajectory.frames.length > 0) {
            const timesteps = trajectory.frames
                .map((frame: any) => frame.timestep)
                .filter((ts: any) => ts !== undefined && ts !== null);

            if (timesteps.length > 0) {
                // Sort numerically to get the lowest (earliest) timestep
                const sorted = [...timesteps].sort((a: number, b: number) => a - b);
                response.initialTimestep = sorted[0];
            }
        }

        // 2. Determine initial analysis config
        const analyses = trajectory.analysis ?? [];
        if (analyses.length > 0) {
            // Select the most recent analysis by default
            response.initialAnalysisConfig = analyses[analyses.length - 1];
        }

        return response;
    }
}
