import { ErrorCodes } from '@core/constants/error-codes';
import type {
    GetScriptingSessionStatusInputDTO,
    GetScriptingSessionStatusOutputDTO
} from '@modules/scripting/application/dtos/ScriptingSessionDTO';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { buildJupyterProxyUrl } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

@Singleton()
export class GetScriptingSessionStatusUseCase implements IUseCase<GetScriptingSessionStatusInputDTO, GetScriptingSessionStatusOutputDTO, ApplicationError> {
    constructor(
        private readonly scriptingNotebookRepository: ScriptingNotebookRepository,
        private readonly scriptingJupyterAccessTokenService: ScriptingJupyterAccessTokenService,
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
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
};
