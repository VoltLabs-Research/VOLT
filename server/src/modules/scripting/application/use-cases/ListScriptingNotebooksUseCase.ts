import {
    ListScriptingNotebooksInputDTO,
    ListScriptingNotebooksOutputDTO
} from '@modules/scripting/application/dtos/ListScriptingNotebooksDTO';
import { toScriptingNotebookDTO } from '@modules/scripting/application/utilities/to-scripting-notebook-dto';
import { ScriptingNotebookScope } from '@modules/scripting/domain/entities/ScriptingNotebookScope';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { CLUSTER_POPULATE, TRAJECTORY_POPULATE, USER_POPULATE } from '@shared/application/PopulatePresets';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class ListScriptingNotebooksUseCase implements IUseCase<ListScriptingNotebooksInputDTO, ListScriptingNotebooksOutputDTO, ApplicationError> {
    constructor(
        private readonly scriptingNotebookRepository: ScriptingNotebookRepository
    ) {}

    async execute(input: ListScriptingNotebooksInputDTO): Promise<Result<ListScriptingNotebooksOutputDTO, ApplicationError>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(500, input.limit ?? 500));
        const filter: Record<string, unknown> = { team: input.teamId };

        if (input.trajectoryId) {
            filter.trajectory = input.trajectoryId;
        } else if (input.scope === ScriptingNotebookScope.General) {
            filter.$or = [
                { trajectory: null },
                { trajectory: { $exists: false } }
            ];
        } else if (input.scope === ScriptingNotebookScope.Trajectory) {
            filter.trajectory = {
                $exists: true,
                $ne: null
            };
        }

        const result = await this.scriptingNotebookRepository.findAll({
            filter,
            page,
            limit,
            sort: { updatedAt: -1 },
            populate: [
                CLUSTER_POPULATE,
                TRAJECTORY_POPULATE,
                USER_POPULATE
            ]
        });

        return Result.ok({
            ...result,
            data: result.data.map(toScriptingNotebookDTO)
        });
    }
}
