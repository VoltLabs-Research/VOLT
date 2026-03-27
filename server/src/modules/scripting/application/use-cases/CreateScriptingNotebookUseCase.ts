import { buildScriptingNotebookPath, DEFAULT_SCRIPTING_NOTEBOOK_TITLE } from '@modules/scripting/application/utilities/build-scripting-notebook';
import { toScriptingNotebookDTO } from '@modules/scripting/application/utilities/to-scripting-notebook-dto';
import {
    CreateScriptingNotebookInputDTO,
    CreateScriptingNotebookOutputDTO
} from '@modules/scripting/application/dtos/CreateScriptingNotebookDTO';
import { JupyterNotebookService } from '@modules/scripting/infrastructure/services/JupyterNotebookService';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { randomUUID } from 'node:crypto';
import { inject, injectable } from 'tsyringe';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';

@injectable()
export class CreateScriptingNotebookUseCase implements IUseCase<CreateScriptingNotebookInputDTO, CreateScriptingNotebookOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository,

        @inject(JupyterNotebookService)
        private readonly jupyterNotebookService: JupyterNotebookService,

        @inject(TeamClusterSelectionService)
        private readonly teamClusterSelectionService: TeamClusterSelectionService
    ) {}

    async execute(input: CreateScriptingNotebookInputDTO): Promise<Result<CreateScriptingNotebookOutputDTO, ApplicationError>> {
        if (!input.userId) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                ErrorCodes.AUTHENTICATION_REQUIRED
            ));
        }

        try {
            const notebookContent = await this.jupyterNotebookService.resolveNotebookTemplateContent({});
            const now = new Date();
            const teamClusterId = await this.teamClusterSelectionService.resolveConnectedClusterId(input.teamId, input.teamClusterId);
            const createData: ScriptingNotebookProps = {
                team: input.teamId,
                teamCluster: teamClusterId,
                containerResources: {
                    cpus: input.containerResources.cpus,
                    memoryMB: input.containerResources.memoryMB
                },
                title: input.title?.trim() || DEFAULT_SCRIPTING_NOTEBOOK_TITLE,
                notebookPath: buildScriptingNotebookPath(randomUUID()),
                trajectory: null,
                createdBy: input.userId,
                content: notebookContent,
                createdAt: now,
                updatedAt: now
            };
            const notebook = await this.scriptingNotebookRepository.create(createData);

            return Result.ok(toScriptingNotebookDTO(notebook));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to create notebook',
                500
            ));
        }
    }
};
