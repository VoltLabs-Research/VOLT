import { buildKeys, createQuery } from '@/shared/infrastructure/query';
import {
    buildCanvasDataAccess,
    DEFAULT_CANVAS_ACCESS_STATE,
    useCanvasAccessStore,
    withAccessMode
} from '@/modules/canvas/api/access';
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

const getSimulationCellWithAccess = (params: GetSimulationCellByTrajectoryParams) => {
    const mode = useCanvasAccessStore.getState().mode;
    return buildCanvasDataAccess({ ...DEFAULT_CANVAS_ACCESS_STATE, mode }).getSimulationCell(params);
};

const simulationCellByTrajectoryKey = (params: GetSimulationCellByTrajectoryParams) => {
    return withAccessMode(useCanvasAccessStore.getState().mode, KEYS.byTrajectory(params));
};

export const simulationCellByTrajectoryQuery = createQuery(
    simulationCellByTrajectoryKey,
    getSimulationCellWithAccess
);
