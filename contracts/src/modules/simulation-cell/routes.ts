import { get } from '../../shared/routing';
import type {
    PersistedSimulationCell,
    GetSimulationCellResponse,
    GetSimulationCellByTrajectoryResponse
} from './domain';

/**
 * Every client-facing simulation-cell endpoint, typed by response. All paths are
 * the full wire paths (team-scoped under `/api/simulation-cells/:teamId`),
 * matching the previous `createHttpModule({ basePath: '/api/simulation-cells/:teamId' })`
 * routing verbatim. Order matters for the controller: the literal
 * `/trajectories/:trajectoryId` route is declared before the `/:simulationCellId`
 * param route so Express matches it first.
 */
export const simulationCellRoutes = {
    list: get<PersistedSimulationCell>('/api/simulation-cells/:teamId'),
    getByTrajectory: get<GetSimulationCellByTrajectoryResponse>('/api/simulation-cells/:teamId/trajectories/:trajectoryId'),
    get: get<GetSimulationCellResponse>('/api/simulation-cells/:teamId/:simulationCellId')
} as const;
