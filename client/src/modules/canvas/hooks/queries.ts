import canvasService from '../api/services/canvas';
import trajectoryCloneService from '../api/services/trajectory-clone';
import { buildKeys, createMutation, createQuery } from '@/shared/infrastructure/query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { CloneTrajectoryInput, CloneTrajectoryOutput } from '@/modules/canvas/api/dtos/clone';
import type {
    GetPublicCanvasBootstrapInput,
    GetPublicCanvasBootstrapOutput
} from '@/modules/canvas/api/dtos/bootstrap';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

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
