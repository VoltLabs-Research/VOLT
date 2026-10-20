import { get } from '../../shared/routing';
import type {
    SimulationCell,
    GetSimulationCellByTrajectoryResponse
} from './domain';

export const simulationCellRoutes = {
    list: get<SimulationCell>('/api/teams/:teamId/simulation-cells'),
    getByTrajectory: get<GetSimulationCellByTrajectoryResponse>('/api/teams/:teamId/trajectories/:trajectoryId/simulation-cell'),
    get: get<SimulationCell>('/api/teams/:teamId/simulation-cells/:simulationCellId')
} as const;
