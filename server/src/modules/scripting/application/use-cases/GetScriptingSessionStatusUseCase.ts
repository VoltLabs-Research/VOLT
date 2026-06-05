import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import { inject } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import type {
    GetScriptingSessionStatusInputDTO,
    GetScriptingSessionStatusOutputDTO
} from '@modules/scripting/application/dtos/ScriptingSessionDTO';
import type { IScriptingJupyterAccessTokenService } from '@modules/scripting/domain/port/IScriptingJupyterAccessTokenService';
import { buildJupyterProxyUrl } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class GetScriptingSessionStatusUseCase implements IUseCase<GetScriptingSessionStatusInputDTO, GetScriptingSessionStatusOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(SCRIPTING_TOKENS.ScriptingJupyterAccessTokenService) private readonly scriptingJupyterAccessTokenService: IScriptingJupyterAccessTokenService,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly teamClusterDaemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(input: GetScriptingSessionStatusInputDTO): Promise<Result<GetScriptingSessionStatusOutputDTO, ApplicationError>> {
        if (!input.userId) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                ErrorCodes.AUTHENTICATION_REQUIRED
            ));
        }

        const notebook = await this.scriptingNotebookRepository.findByTeamAndNotebookId(input.teamId, input.notebookId);

        if (!notebook) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND,
                'Notebook not found'
            ));
        }

        const runtimeNotebookId = notebook.props.runtimeNotebookId;

        if (!runtimeNotebookId) {
            return Result.ok({
                notebookId: notebook._id,
                jupyter: { ready: false, url: '', containerStage: 'creating' }
            });
        }

        const accessToken = this.scriptingJupyterAccessTokenService.create({
            teamId: input.teamId,
            runtimeNotebookId,
            userId: input.userId
        });
        const url = buildJupyterProxyUrl({
            teamId: input.teamId,
            runtimeNotebookId,
            notebookPath: notebook.props.notebookPath,
            accessToken
        });

        if (!notebook.props.teamCluster) {
            return Result.ok({
                notebookId: notebook._id,
                runtimeNotebookId,
                accessToken,
                jupyter: { ready: false, url, containerStage: 'creating' }
            });
        }

        const { runtime } = await this.teamClusterDaemonClient.getNotebookRuntime(
            notebook.props.teamCluster,
            runtimeNotebookId
        );

        return Result.ok({
            notebookId: notebook._id,
            runtimeNotebookId,
            accessToken,
            jupyter: {
                ready: Boolean(runtime),
                url,
                containerStage: runtime ? 'ready' : 'starting'
            }
        });
    }
}
