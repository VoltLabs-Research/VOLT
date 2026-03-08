import { buildKeys, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
import service from '../api/service';
import type { GetSimulationCellsParams } from '../api/dtos/get-simulation-cells';
import type { GetSimulationCellByTrajectoryParams } from '../api/dtos/get-simulation-cell-by-trajectory';

type SimulationCellQueryKeys = {
    listing: GetSimulationCellsParams;
    byTrajectory: GetSimulationCellByTrajectoryParams;
};

const BASE_KEY = 'simulation-cells';

export const KEYS = buildKeys<SimulationCellQueryKeys>(BASE_KEY);

export const simulationCellsQueryKey = KEYS.listing;

export const simulationCellsQuery = createQuery(KEYS.listing, service.getAll);
export const simulationCellByTrajectoryQuery = createQuery(KEYS.byTrajectory, service.getByTrajectory);
