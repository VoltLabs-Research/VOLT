import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
import { currentCanvasDataAccess, currentAccessKey } from '@/modules/canvas/api/access/use-canvas-access-store';
import service from '../api/service';
import type { GetSimulationCellByTrajectoryParams, GetSimulationCellsParams } from '../api/service';

const KEYS = buildKeys<{
    listing: GetSimulationCellsParams;
    byTrajectory: GetSimulationCellByTrajectoryParams;
}>('simulation-cells');

export const simulationCellsQueryKey = KEYS.listing;

export const simulationCellsQuery = createQuery(KEYS.listing, service.getAll);

export const simulationCellByTrajectoryQuery = createQuery(
    (params: GetSimulationCellByTrajectoryParams) => currentAccessKey(KEYS.byTrajectory(params)),
    (params: GetSimulationCellByTrajectoryParams) => currentCanvasDataAccess().getSimulationCell(params)
);
