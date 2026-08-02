import { buildKeys, createQuery } from '@/shared/query';
import {
    currentCanvasDataAccess,
    currentAccessKey
} from '@/modules/canvas/api/access';
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
