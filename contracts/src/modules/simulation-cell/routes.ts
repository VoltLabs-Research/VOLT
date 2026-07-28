import { get } from '../../shared/routing';
import type {
    SimulationCell,
    GetSimulationCellResponse,
    GetSimulationCellByTrajectoryResponse
} from './domain';

export const simulationCellRoutes = {
    list: get<SimulationCell>('/api/simulation-cells/:teamId'),
    getByTrajectory: get<GetSimulationCellByTrajectoryResponse>('/api/simulation-cells/:teamId/trajectories/:trajectoryId'),
    get: get<GetSimulationCellResponse>('/api/simulation-cells/:teamId/:simulationCellId')
} as const;
