import { get } from '../../shared/routing';
import type {
    PersistedSimulationCell,
    GetSimulationCellResponse,
    GetSimulationCellByTrajectoryResponse
} from './domain';

export const simulationCellRoutes = {
    list: get<PersistedSimulationCell>('/api/simulation-cells/:teamId'),
    getByTrajectory: get<GetSimulationCellByTrajectoryResponse>('/api/simulation-cells/:teamId/trajectories/:trajectoryId'),
    get: get<GetSimulationCellResponse>('/api/simulation-cells/:teamId/:simulationCellId')
} as const;
