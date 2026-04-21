import { AITool } from '@shared/application/ai/AITool';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import type { SimulationCellTrajectoryReference } from '@modules/simulation-cell/domain/entities/SimulationCell';

@injectable()
export class ListSimulationCellsAITool extends AITool {
    readonly name = 'list_simulation_cells';
    readonly description = 'List all simulation cells in the selected team.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50)
    });

    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        protected readonly repository: ISimulationCellRepository
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.repository.findAll({
            filter: { team: scope.teamId },
            populate: { path: 'trajectory', select: ['name'] },
            page: params.page,
            limit: params.limit
        });

        return {
            summary: `Found ${result.total} simulation cells.`,
            data: result.data.map((cell) => {
                const trajectoryRef = cell.props.trajectory as string | SimulationCellTrajectoryReference;
                let trajectory = '';
                let boundingBox = '';

                if (typeof trajectoryRef === 'string') {
                    trajectory = trajectoryRef;
                } else if (trajectoryRef?.name) {
                    trajectory = trajectoryRef.name;
                }

                if (cell.props.boundingBox) {
                    boundingBox = `${cell.props.boundingBox.width}x${cell.props.boundingBox.height}x${cell.props.boundingBox.length}`;
                }

                return {
                    cellId: cell._id,
                    timestep: cell.props.timestep,
                    trajectory,
                    boundingBox,
                    createdAt: cell.props.createdAt ?? null
                };
            }),
            total: result.total
        };
    }
};
