import { ErrorCodes } from '@core/constants/error-codes';
import SimulationCell from '@modules/simulation-cell/models/SimulationCell';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    GetSimulationCellByTrajectoryInput,
    GetSimulationCellByTrajectoryOutput
} from '@shared/contracts/operations/GetSimulationCellByTrajectory';
import type { SimulationCellDims, SimulationCellGeometry } from '@volt/contracts/modules/simulation-cell/domain';
import type { SimulationCellProps } from '@shared/contracts/types/SimulationCell';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { DeepPartial, FindManyOptions, FindOptionsWhere } from 'typeorm';

interface ListSimulationCellsInput {
    teamId: string;
    page?: string;
    limit?: string;
    trajectoryId?: string;
    timestep?: string;
}

const DEFAULT_LIST_LIMIT = 10;

const TRAJECTORY_REFERENCE_OPTIONS = {
    relations: { trajectoryRef: true },
    select: {
        trajectoryRef: {
            id: true,
            name: true
        }
    }
} satisfies FindManyOptions<SimulationCell>;

const toSimulationCellView = (cell: SimulationCell): PersistedOutput<SimulationCellProps> => ({
    _id: cell.id,
    boundingBox: cell.boundingBox as SimulationCellDims,
    geometry: cell.geometry as SimulationCellGeometry,
    team: cell.team,
    trajectory: cell.trajectoryRef
        ? {
            _id: cell.trajectoryRef.id,
            name: cell.trajectoryRef.name
        }
        : cell.trajectory,
    timestep: cell.timestep,
    createdAt: cell.createdAt,
    updatedAt: cell.updatedAt
});

const toInsertableSimulationCell = (item: Partial<SimulationCellProps>): DeepPartial<SimulationCell> => ({
    boundingBox: item.boundingBox ?? null,
    geometry: item.geometry ?? null,
    team: item.team,
    trajectory: typeof item.trajectory === 'string' ? item.trajectory : item.trajectory?._id,
    timestep: item.timestep
});

export default class SimulationCellService{
    async list(input: ListSimulationCellsInput): Promise<PaginatedResult<PersistedOutput<SimulationCellProps>>>{
        const pageRequest = readPageRequest(Number(input.page), Number(input.limit), { defaultLimit: DEFAULT_LIST_LIMIT });
        const where: FindOptionsWhere<SimulationCell> = { team: input.teamId };

        if(input.trajectoryId){
            where.trajectory = input.trajectoryId;
        }

        if(input.timestep !== undefined){
            where.timestep = Number(input.timestep);
        }

        const [cells, total] = await SimulationCell.findAndCount({
            where,
            ...TRAJECTORY_REFERENCE_OPTIONS,
            take: pageRequest.limit,
            skip: skipFor(pageRequest)
        });

        return paginate([cells.map(toSimulationCellView), total], pageRequest);
    }

    async getByTrajectory(input: GetSimulationCellByTrajectoryInput): Promise<GetSimulationCellByTrajectoryOutput>{
        const baseWhere: FindOptionsWhere<SimulationCell> = {
            team: input.teamId,
            trajectory: input.trajectoryId
        };

        if(input.timestep !== undefined){
            const exactMatch = await SimulationCell.findOne({
                where: {
                    ...baseWhere,
                    timestep: input.timestep
                },
                ...TRAJECTORY_REFERENCE_OPTIONS
            });

            if(exactMatch){
                return toSimulationCellView(exactMatch);
            }
        }

        const fallback = await SimulationCell.findOne({
            where: baseWhere,
            order: { timestep: 'DESC' },
            ...TRAJECTORY_REFERENCE_OPTIONS
        });

        return fallback ? toSimulationCellView(fallback) : null;
    }

    async getById(simulationCellId: string): Promise<PersistedOutput<SimulationCellProps>>{
        const simulationCell = await SimulationCell.findOne({
            where: { id: simulationCellId },
            ...TRAJECTORY_REFERENCE_OPTIONS
        });

        if(!simulationCell){
            throw ApplicationError.notFound(
                ErrorCodes.SIMULATION_CELL_NOT_FOUND,
                'SimulationCell not found'
            );
        }

        return toSimulationCellView(simulationCell);
    }
}

export const insertSimulationCells = async (
    items: Array<Partial<SimulationCellProps>>
): Promise<Array<{ _id: string }>> => {
    if(items.length === 0){
        return [];
    }

    const inserted = await SimulationCell.save(SimulationCell.create(items.map(toInsertableSimulationCell)));
    return inserted.map((cell) => ({ _id: cell.id }));
};
