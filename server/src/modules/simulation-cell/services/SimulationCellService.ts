import { ErrorCodes } from '@core/constants/error-codes';
import SimulationCellModel from '@modules/simulation-cell/models/SimulationCellModel';
import type { SimulationCellDocument } from '@modules/simulation-cell/models/SimulationCellModel';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    GetSimulationCellByTrajectoryInputDTO,
    GetSimulationCellByTrajectoryOutputDTO
} from '@shared/contracts/dtos/GetSimulationCellByTrajectoryDTO';
import type { SimulationCellProps } from '@shared/contracts/types/SimulationCell';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { TRAJECTORY_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';

interface ListSimulationCellsInput {
    teamId: string;
    page?: string;
    limit?: string;
    trajectoryId?: string;
    timestep?: string;
}

interface GetSimulationCellByIdInput {
    simulationCellId: string;
}

/**
 * Flattens a Mongoose simulation-cell document to the persisted-output wire
 * shape (`{ _id, ...props }`), reproducing the former mapper + `toPersistedOutput`
 * behaviour verbatim: `_id`/`__v` are dropped, and unpopulated relation refs are
 * coerced to string ids (populated refs are left as nested objects).
 */
const toSimulationCellView = (doc: SimulationCellDocument): PersistedOutput<SimulationCellProps> => {
    const { _id, __v, ...props } = doc.toObject({ flattenMaps: true }) as Record<string, unknown>;
    if (props.team && !doc.populated('team')) {
        props.team = String(props.team);
    }
    if (props.trajectory && !doc.populated('trajectory')) {
        props.trajectory = String(props.trajectory);
    }
    return { _id: String(doc._id), ...(props as unknown as SimulationCellProps) };
};

/**
 * The single application service for the simulation-cell module (pollium style):
 * holds ALL the simulation-cell HTTP domain logic and talks to the Mongoose
 * {@link SimulationCellModel} directly — no repository, entity, mapper, use case
 * or DI. `list` and `getById` fold the logic that previously lived inline in the
 * route handlers; `getByTrajectory` folds the former
 * `GetSimulationCellByTrajectoryUseCase` verbatim (its cross-module port is still
 * served by a thin adapter under `SIMULATION_CELL_CONTRACT_TOKENS.GetSimulationCellByTrajectoryUseCase`
 * that delegates here). Throws typed {@link ApplicationError}s (no Result channel).
 */
export default class SimulationCellService {
    async list(input: ListSimulationCellsInput): Promise<PaginatedResult<PersistedOutput<SimulationCellProps>>> {
        const page = input.page !== undefined ? Number(input.page) : 1;
        const limit = input.limit !== undefined ? Number(input.limit) : 10;
        const filter: Record<string, unknown> = { team: input.teamId };

        if (input.trajectoryId) {
            filter.trajectory = input.trajectoryId;
        }

        if (input.timestep !== undefined) {
            filter.timestep = Number(input.timestep);
        }

        const [docs, total] = await Promise.all([
            SimulationCellModel.find(filter)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate(TRAJECTORY_POPULATE)
                .exec(),
            SimulationCellModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => toSimulationCellView(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async getByTrajectory(input: GetSimulationCellByTrajectoryInputDTO): Promise<GetSimulationCellByTrajectoryOutputDTO> {
        const baseFilter: Record<string, unknown> = {
            team: input.teamId,
            trajectory: input.trajectoryId
        };

        if (input.timestep !== undefined) {
            const exactMatch = await SimulationCellModel.findOne({ ...baseFilter, timestep: input.timestep })
                .populate(TRAJECTORY_POPULATE)
                .exec();

            if (exactMatch) {
                return toSimulationCellView(exactMatch);
            }
        }

        const fallback = await SimulationCellModel.findOne(baseFilter)
            .sort({ timestep: -1 })
            .populate(TRAJECTORY_POPULATE)
            .exec();

        return fallback ? toSimulationCellView(fallback) : null;
    }

    async getById(input: GetSimulationCellByIdInput): Promise<PersistedOutput<SimulationCellProps>> {
        const simulationCell = await SimulationCellModel.findById(input.simulationCellId)
            .populate(TRAJECTORY_POPULATE)
            .exec();

        if (!simulationCell) {
            throw ApplicationError.notFound(
                ErrorCodes.SIMULATION_CELL_NOT_FOUND,
                'SimulationCell not found'
            );
        }

        return toSimulationCellView(simulationCell);
    }
}
