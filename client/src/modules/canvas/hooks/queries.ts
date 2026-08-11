import canvasService from '../api/services/canvas-service';
import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
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

export const CANVAS_QUERY_KEYS = {
    bootstrap: KEYS.bootstrap,
    trajectory: KEYS.trajectory,
    analyses: KEYS.analyses
} as const;
