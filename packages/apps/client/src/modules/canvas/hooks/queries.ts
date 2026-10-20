import canvasService from '@/modules/canvas/api/services/canvas-service';
import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type {
    GetPublicCanvasBootstrapInput,
    GetPublicCanvasBootstrapOutput
} from '@/modules/canvas/api/services/canvas-service';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

export const CANVAS_QUERY_KEYS = buildKeys<{
    bootstrap: GetPublicCanvasBootstrapInput;
    trajectory: { trajectoryId: string };
    analyses: { trajectoryId: string; page?: number; limit?: number };
}>('canvas');

export const useCanvasBootstrapQuery = createQuery<GetPublicCanvasBootstrapInput, GetPublicCanvasBootstrapOutput>(
    CANVAS_QUERY_KEYS.bootstrap,
    (params) => canvasService.getBootstrap(params)
);

export const useCanvasTrajectoryQuery = createQuery<{ trajectoryId: string }, Trajectory>(
    CANVAS_QUERY_KEYS.trajectory,
    (params) => canvasService.getTrajectory(params)
);

export const useCanvasAnalysesQuery = createQuery<{ trajectoryId: string; page?: number; limit?: number }, PaginatedResponse<Analysis>>(
    CANVAS_QUERY_KEYS.analyses,
    (params) => canvasService.listAnalyses(params)
);
