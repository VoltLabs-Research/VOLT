import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import { SCRIPTING_TOKENS } from '@modules/scripting/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/ports/IScriptingNotebookRepository';
import { inject } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import {
    CreateScriptingNotebookInputDTO,
    CreateScriptingNotebookOutputDTO
} from '@modules/scripting/dtos/CreateScriptingNotebookDTO';
import { buildScriptingNotebookPath, DEFAULT_SCRIPTING_NOTEBOOK_TITLE } from '@modules/scripting/utilities/build-scripting-notebook';
import { toScriptingNotebookDTO } from '@modules/scripting/utilities/to-scripting-notebook-dto';
import type { ScriptingNotebookProps } from '@modules/scripting/entities/ScriptingNotebook';
import type { IJupyterNotebookService } from '@modules/scripting/ports/IJupyterNotebookService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { randomUUID } from 'node:crypto';

@Singleton()
export class CreateScriptingNotebookUseCase implements IUseCase<CreateScriptingNotebookInputDTO, CreateScriptingNotebookOutputDTO> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(SCRIPTING_TOKENS.JupyterNotebookService) private readonly jupyterNotebookService: IJupyterNotebookService,
        @inject(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService
    ) {}

    async execute(input: CreateScriptingNotebookInputDTO): Promise<CreateScriptingNotebookOutputDTO> {
        if (!input.userId) {
            throw ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                ErrorCodes.AUTHENTICATION_REQUIRED
            );
        }

        try {
            const notebookContent = await this.jupyterNotebookService.resolveNotebookTemplateContent();
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

            return toScriptingNotebookDTO(notebook);
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to create notebook',
                500
            );
        }
    }
}
