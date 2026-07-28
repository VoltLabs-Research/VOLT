import canvasService from '../api/services/canvas-service';
import trajectoryCloneService from '../api/services/trajectory-clone';
import { buildKeys, createMutation, createQuery } from '@/shared/query';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { CloneTrajectoryOutput } from '@/modules/canvas/api/services/trajectory-clone';
import type { CloneTrajectoryInput } from '@volt/contracts/modules/trajectory/http';
import type {
    GetPublicCanvasBootstrapInput,
    GetPublicCanvasBootstrapOutput
} from '@/modules/canvas/api/services/canvas-service';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

const BASE_KEY = 'canvas';

const KEYS = buildKeys<{
    bootstrap: GetPublicCanvasBootstrapInput;
    trajectory: { trajectoryId: string };
    analyses: { trajectoryId: string; page?: number; limit?: number };
}>(BASE_KEY);

const bootstrapQuery = createQuery<GetPublicCanvasBootstrapInput, GetPublicCanvasBootstrapOutput>(
    KEYS.bootstrap,
    (params) => canvasService.getBootstrap(params)
);

const canvasTrajectoryQuery = createQuery<{ trajectoryId: string }, Trajectory>(
    KEYS.trajectory,
    (params) => canvasService.getTrajectory(params)
);

const canvasAnalysesQuery = createQuery<{ trajectoryId: string; page?: number; limit?: number }, PaginatedResponse<Analysis>>(
    KEYS.analyses,
    (params) => canvasService.listAnalyses(params)
);

export const useCanvasBootstrapQuery = bootstrapQuery;
export const useCanvasTrajectoryQuery = canvasTrajectoryQuery;
export const useCanvasAnalysesQuery = canvasAnalysesQuery;

export const useCloneTrajectoryMutation = createMutation<CloneTrajectoryOutput, CloneTrajectoryInput>(
    (input) => trajectoryCloneService.clone(input)
);

export const CANVAS_QUERY_KEYS = {
    bootstrap: KEYS.bootstrap,
    trajectory: KEYS.trajectory,
    analyses: KEYS.analyses
} as const;
