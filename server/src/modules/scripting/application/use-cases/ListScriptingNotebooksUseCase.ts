import { toScriptingNotebookDTO } from '@modules/scripting/application/utilities/to-scripting-notebook-dto';
import {
    ListScriptingNotebooksInputDTO,
    ListScriptingNotebooksOutputDTO
} from '@modules/scripting/application/dtos/ListScriptingNotebooksDTO';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { ScriptingNotebookScope } from '@modules/scripting/domain/entities/ScriptingNotebookScope';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';

@injectable()
export class ListScriptingNotebooksUseCase implements IUseCase<ListScriptingNotebooksInputDTO, ListScriptingNotebooksOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository
    ) {}

    async execute(input: ListScriptingNotebooksInputDTO): Promise<Result<ListScriptingNotebooksOutputDTO, ApplicationError>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Math.min(500, Number(input.limit || 500)));
        const filter: Record<string, unknown> = { team: input.teamId };

        if (input.trajectoryId) {
            filter.$or = [
                { trajectory: input.trajectoryId },
                { trajectories: input.trajectoryId }
            ];
        } else if (input.scope === ScriptingNotebookScope.General) {
            filter.$and = [
                {
                    $or: [
                        { trajectory: null },
                        { trajectory: { $exists: false } }
                    ]
                },
                {
                    $or: [
                        { trajectories: { $exists: false } },
                        { trajectories: { $size: 0 } }
                    ]
                }
            ];
        } else if (input.scope === ScriptingNotebookScope.Trajectory) {
            filter.$or = [
                {
                    trajectory: {
                        $exists: true,
                        $ne: null
                    }
                },
                {
                    'trajectories.0': {
                        $exists: true
                    }
                }
            ];
        }

        const result = await this.scriptingNotebookRepository.findAll({
            filter,
            page,
            limit,
            sort: { updatedAt: -1 },
            populate: [
                {
                    path: 'teamCluster',
                    select: ['name']
                },
                {
                    path: 'trajectory',
                    select: ['name']
                },
                {
                    path: 'createdBy',
                    select: ['firstName', 'lastName', 'email', 'avatar']
                }
            ]
        });

        return Result.ok({
            ...result,
            data: result.data.map(toScriptingNotebookDTO)
        });
    }
};
