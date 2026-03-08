import { buildKeys, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
import type { GetSimulationCellsParams } from '../api/dtos/get-simulation-cells';
import type { GetSimulationCellByTrajectoryParams } from '../api/dtos/get-simulation-cell-by-trajectory';
import service from '../api/service';

const BASE_KEY = 'simulation-cells';

export const KEYS = buildKeys<{
    listing: GetSimulationCellsParams;
    byTrajectory: GetSimulationCellByTrajectoryParams;
}>(BASE_KEY);

export const simulationCellsQueryKey = () => KEYS.listing();

export const simulationCellsQuery = createQuery(KEYS.listing, (params) => service.getAll(params));
export const simulationCellByTrajectoryQuery = createQuery(KEYS.byTrajectory, (params) => service.getByTrajectory(params));
