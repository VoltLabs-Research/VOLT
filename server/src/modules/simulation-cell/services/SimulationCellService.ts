import { ErrorCodes } from '@core/constants/error-codes';
import SimulationCellModel from '@modules/simulation-cell/models/SimulationCellModel';
import type { SimulationCellDocument } from '@modules/simulation-cell/models/SimulationCellModel';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    GetSimulationCellByTrajectoryInput,
    GetSimulationCellByTrajectoryOutput
} from '@shared/contracts/operations/GetSimulationCellByTrajectory';
import type { SimulationCellProps } from '@shared/contracts/types/SimulationCell';
import type { PaginatedResult } from '@shared/domain/port/persistence';
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

    async getByTrajectory(input: GetSimulationCellByTrajectoryInput): Promise<GetSimulationCellByTrajectoryOutput> {
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
