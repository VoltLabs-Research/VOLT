import { buildKeys, createQuery } from '@/shared/infrastructure/query';
import {
    currentCanvasDataAccess,
    currentAccessKey
} from '@/modules/canvas/api/access';
import service from '../api/service';
import type { GetSimulationCellByTrajectoryParams, GetSimulationCellsParams } from '../api/service';

type SimulationCellQueryKeys = {
    listing: GetSimulationCellsParams;
    byTrajectory: GetSimulationCellByTrajectoryParams;
};

const BASE_KEY = 'simulation-cells';

export const KEYS = buildKeys<SimulationCellQueryKeys>(BASE_KEY);

export const simulationCellsQueryKey = KEYS.listing;

export const simulationCellsQuery = createQuery(KEYS.listing, service.getAll);

const getSimulationCellWithAccess = (params: GetSimulationCellByTrajectoryParams) => {
    return currentCanvasDataAccess().getSimulationCell(params);
};

const simulationCellByTrajectoryKey = (params: GetSimulationCellByTrajectoryParams) => {
    return currentAccessKey(KEYS.byTrajectory(params));
};

export const simulationCellByTrajectoryQuery = createQuery(
    simulationCellByTrajectoryKey,
    getSimulationCellWithAccess
);
