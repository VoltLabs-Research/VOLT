import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { buildKeys, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
import {
    useCanvasAccessMode,
    useCanvasDataAccess,
    withAccessMode
} from '@/modules/canvas/api/access';
import service from '../api/service';
import type { SimulationCell } from '../api/entities/simulation-cell';
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

type SimulationCellByTrajectoryResult = SimulationCell | null;

type SimulationCellQueryOptions = Partial<UseQueryOptions<SimulationCellByTrajectoryResult, Error, SimulationCellByTrajectoryResult>>;

export const simulationCellByTrajectoryQuery = (
    params: GetSimulationCellByTrajectoryParams,
    options?: SimulationCellQueryOptions
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();

    return useQuery<SimulationCellByTrajectoryResult, Error, SimulationCellByTrajectoryResult>({
        ...options,
        queryKey: withAccessMode(mode, KEYS.byTrajectory(params)),
        queryFn: () => dataAccess.getSimulationCell(params)
    });
};
