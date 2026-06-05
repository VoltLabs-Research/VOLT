import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import { inject } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterSelectionService } from '@modules/container/domain/port/ITeamClusterSelectionService';
import {
    CreateScriptingNotebookInputDTO,
    CreateScriptingNotebookOutputDTO
} from '@modules/scripting/application/dtos/CreateScriptingNotebookDTO';
import { buildScriptingNotebookPath, DEFAULT_SCRIPTING_NOTEBOOK_TITLE } from '@modules/scripting/application/utilities/build-scripting-notebook';
import { toScriptingNotebookDTO } from '@modules/scripting/application/utilities/to-scripting-notebook-dto';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { IJupyterNotebookService } from '@modules/scripting/domain/port/IJupyterNotebookService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { randomUUID } from 'node:crypto';

@Singleton()
export class CreateScriptingNotebookUseCase implements IUseCase<CreateScriptingNotebookInputDTO, CreateScriptingNotebookOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(SCRIPTING_TOKENS.JupyterNotebookService) private readonly jupyterNotebookService: IJupyterNotebookService,
        @inject(CONTAINER_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService
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
}
