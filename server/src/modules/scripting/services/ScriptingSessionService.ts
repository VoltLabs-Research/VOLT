import { ErrorCodes } from '@core/constants/error-codes';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import daemonScriptingSessionOrchestrator from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import type { ScriptingSessionStartInput } from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import redisScriptingSessionLock from '@modules/scripting/services/RedisScriptingSessionLock';
import type { ScriptingSessionLockLease } from '@modules/scripting/services/RedisScriptingSessionLock';
import notebookCredentialService from '@modules/scripting/services/NotebookCredentialService';
import notebookRuntimeTerminator from '@modules/scripting/services/NotebookRuntimeTerminator';
import scriptingSessionNotebookResolver from '@modules/scripting/services/ScriptingSessionNotebookResolver';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/services/ScriptingJupyterAccessTokenService';
import { attachScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';
import type { ScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';
import { buildJupyterProxyUrl, findNotebookExposure } from '@modules/scripting/services/ScriptingJupyterProxySupport';
import type { CreateJupyterSessionInput } from '@modules/scripting/contracts/notebook-session';
import type { NotebookIdentityInput } from '@modules/scripting/contracts/scripting-notebook';
import type {
    CreateScriptingJupyterSessionResponse,
    DeleteScriptingSessionResponse,
    GetScriptingSessionStatusResponse,
    NotebookContainerStage
} from '@volt/contracts/modules/scripting/domain';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import teamClusterExposureRegistryService from '@modules/cluster/services/TeamClusterExposureRegistryService';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';

const LOCK_TTL_MS = 90_000;

interface GetSessionStatusInput extends NotebookIdentityInput{
    userId: string;
}

interface CreateJupyterSessionResult extends CreateScriptingJupyterSessionResponse{
    accessGrant?: ScriptingJupyterAccessGrant;
}

interface GetSessionStatusResult extends GetScriptingSessionStatusResponse{
    accessGrant?: ScriptingJupyterAccessGrant;
}

interface DeleteSessionResult extends DeleteScriptingSessionResponse{
    runtimeNotebookId?: string;
}

const PENDING_JUPYTER_SESSION: CreateJupyterSessionResult = {
    notebookId: '',
    jupyter: {
        url: '',
        ready: false,
        containerStage: 'creating'
    }
};

const buildLockKey = (input: CreateJupyterSessionInput): string | null => {
    if(input.trajectoryId){
        return `lock:jupyter:${input.teamId}:trajectory:${input.trajectoryId}`;
    }
    if(input.notebookId){
        return `lock:jupyter:${input.teamId}:notebook:${input.notebookId}`;
    }

    return null;
};

const mapSessionError = (error: unknown): ApplicationError => {
    if(error instanceof ApplicationError){
        return error;
    }
    if(error instanceof Error){
        const isDaemonError = error.message.includes('daemon')
            || error.message.includes('Daemon')
            || error.message.includes('Timed out')
            || error.message.includes('connection was lost');
        const errorCode = isDaemonError ? ErrorCodes.SCRIPTING_DAEMON_UNAVAILABLE : ErrorCodes.SCRIPTING_SESSION_FAILED;
        const statusCode = isDaemonError ? 502 : 500;
        return new ApplicationError(errorCode, error.message, statusCode);
    }

    return new ApplicationError(ErrorCodes.SCRIPTING_SESSION_FAILED, 'Unexpected scripting error', 500);
};

export default class ScriptingSessionService{
    #orchestrator = daemonScriptingSessionOrchestrator;
    #lock = redisScriptingSessionLock;
    #credential = notebookCredentialService;
    #terminator = notebookRuntimeTerminator;
    #notebookResolver = scriptingSessionNotebookResolver;
    #exposureRegistry = teamClusterExposureRegistryService;
    #accessToken = new ScriptingJupyterAccessTokenService();

    #teamClusterSelection: ITeamClusterSelectionService = teamClusterSelectionService;

    async createJupyterSession(input: CreateJupyterSessionInput): Promise<CreateJupyterSessionResult>{
        const lockKey = buildLockKey(input);
        if(!lockKey){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Trajectory id or notebook id is required');
        }

        let lease: ScriptingSessionLockLease | null = null;
        try{
            lease = await this.#lock.acquire(lockKey, LOCK_TTL_MS);
            if(!lease){
                return {
                    ...PENDING_JUPYTER_SESSION,
                    notebookId: await this.#notebookResolver.resolvePendingNotebookId(input)
                };
            }

            const notebook = await this.#notebookResolver.resolve(input);
            if(!notebook.teamCluster){
                throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Notebook deployment cluster is not configured');
            }

            const secretKey = await this.#credential.resolveSecretKey(notebook, input.userId);
            const sessionInput: ScriptingSessionStartInput = {
                teamId: input.teamId,
                teamClusterId: await this.#teamClusterSelection.resolveConnectedClusterId(input.teamId, notebook.teamCluster),
                userId: input.userId,
                notebookId: notebook.id,
                trajectoryId: notebook.trajectory,
                secretKey,
                notebook: {
                    notebookPath: notebook.notebookPath,
                    content: notebook.content
                }
            };
            const session = await this.#orchestrator.startSession(sessionInput);

            return attachScriptingJupyterAccessGrant({
                notebookId: notebook.id,
                jupyter: session.jupyter
            }, session.accessGrant);
        }catch(error){
            throw mapSessionError(error);
        }finally{
            await lease?.release();
        }
    }

    async getSessionStatus(input: GetSessionStatusInput): Promise<GetSessionStatusResult>{
        const notebook = await ScriptingNotebook.findOneBy({
            id: input.notebookId,
            team: input.teamId
        });
        if(!notebook){
            throw ApplicationError.notFound(ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND, 'Notebook not found');
        }

        const notebookId = notebook.id;
        const runtimeNotebookId = notebook.runtimeNotebookId;

        if(!runtimeNotebookId){
            return {
                ...PENDING_JUPYTER_SESSION,
                notebookId
            };
        }

        const accessGrant = this.#accessToken.createAccessGrant({
            teamId: input.teamId,
            runtimeNotebookId,
            userId: input.userId
        });
        const url = buildJupyterProxyUrl({
            teamId: input.teamId,
            runtimeNotebookId,
            notebookPath: notebook.notebookPath,
            accessToken: accessGrant.token
        });
        const exposures = notebook.teamCluster
            ? this.#exposureRegistry.listTeamClusterExposures(notebook.teamCluster)
            : [];
        const match = findNotebookExposure(exposures, runtimeNotebookId);
        const startedStage: NotebookContainerStage = match?.ready ? 'ready' : 'starting';

        return attachScriptingJupyterAccessGrant({
            notebookId,
            jupyter: {
                ready: Boolean(match?.ready),
                url,
                containerStage: notebook.teamCluster ? startedStage : 'creating'
            }
        }, accessGrant);
    }

    async deleteSession(input: NotebookIdentityInput): Promise<DeleteSessionResult>{
        const notebook = await ScriptingNotebook.findOneBy({
            id: input.notebookId,
            team: input.teamId
        });
        if(!notebook){
            throw ApplicationError.notFound(ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND, 'Notebook not found');
        }

        const runtimeNotebookId = notebook.runtimeNotebookId;

        if(runtimeNotebookId && notebook.teamCluster){
            await this.#terminator.terminate(notebook.teamCluster, runtimeNotebookId);
        }

        return {
            notebookId: notebook.id,
            deleted: Boolean(runtimeNotebookId),
            runtimeNotebookId: runtimeNotebookId || undefined
        };
    }
}
