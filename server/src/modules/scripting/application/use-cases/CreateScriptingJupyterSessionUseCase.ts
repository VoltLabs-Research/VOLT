import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import {
    CreateScriptingJupyterSessionInputDTO,
    CreateScriptingJupyterSessionOutputDTO
} from '@modules/scripting/application/dtos/CreateScriptingJupyterSessionDTO';
import { buildScriptingNotebookPath, DEFAULT_SCRIPTING_NOTEBOOK_TITLE } from '@modules/scripting/application/utilities/build-scripting-notebook';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { IScriptingSessionLock } from '@modules/scripting/domain/port/IScriptingSessionLock';
import type {
    ScriptingSessionStartInput
} from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import { DaemonScriptingSessionOrchestrator } from '@modules/scripting/infrastructure/services/DaemonScriptingSessionOrchestrator';
import { RedisScriptingSessionLock } from '@modules/scripting/infrastructure/services/RedisScriptingSessionLock';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import pRetry from 'p-retry';

const LOCK_TTL_MS = 90_000;
const LOCK_BUSY_WAIT_ATTEMPTS = 5;
const LOCK_BUSY_WAIT_DELAY_MS = 300;

const PENDING_JUPYTER_SESSION: CreateScriptingJupyterSessionOutputDTO = {
    notebookId: '',
    jupyter: {
        url: '',
        ready: false,
        containerStage: 'creating'
    }
};

const getPrimaryTrajectoryId = (notebook: ScriptingNotebook): string | null => {
    return notebook.props.trajectory ?? null;
};

const getNotebookTeamClusterId = (teamCluster: string | null | undefined): string | undefined => {
    return teamCluster || undefined;
};

const getNotebookSortTimestamp = (notebook: ScriptingNotebook): number => {
    return notebook.props.lastOpenedAt?.getTime() ?? notebook.props.updatedAt.getTime();
};

const selectExistingTrajectoryNotebook = (
    notebooks: ScriptingNotebook[],
    teamId: string
): ScriptingNotebook | null => {
    const teamNotebooks = notebooks.filter((notebook) => notebook.props.team === teamId);

    if (!teamNotebooks.length) {
        return null;
    }

    return [...teamNotebooks].sort((left, right) => {
        const timestampDelta = getNotebookSortTimestamp(right) - getNotebookSortTimestamp(left);
        if (timestampDelta !== 0) {
            return timestampDelta;
        }

        return right._id.localeCompare(left._id);
    })[0] || null;
};

@Singleton()
export class CreateScriptingJupyterSessionUseCase implements IUseCase<CreateScriptingJupyterSessionInputDTO, CreateScriptingJupyterSessionOutputDTO, ApplicationError> {
    constructor(
        private readonly scriptingNotebookRepository: ScriptingNotebookRepository,
        private readonly scriptingSessionOrchestrator: DaemonScriptingSessionOrchestrator,
        private readonly scriptingSessionLock: RedisScriptingSessionLock,
        private readonly teamClusterSelectionService: TeamClusterSelectionService
    ) {}

    async execute(input: CreateScriptingJupyterSessionInputDTO): Promise<Result<CreateScriptingJupyterSessionOutputDTO, ApplicationError>> {
        if (!input.userId) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                ErrorCodes.AUTHENTICATION_REQUIRED
            ));
        }

        const userId = input.userId;

        const lockKey = this.buildLockKey(input);
        if (!lockKey) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                'Trajectory id or notebook id is required'
            ));
        }

        let lease: Awaited<ReturnType<IScriptingSessionLock['acquire']>> = null;
        try {
            lease = await this.scriptingSessionLock.acquire(lockKey, LOCK_TTL_MS);
            if (!lease) {
                const pendingNotebookId = await this.resolvePendingNotebookId(input);
                return Result.ok({
                    ...PENDING_JUPYTER_SESSION,
                    notebookId: pendingNotebookId
                });
            }

            const notebook = await this.resolveNotebookForSession(input, userId);
            const sessionInput: ScriptingSessionStartInput = {
                teamId: input.teamId,
                teamClusterId: await this.resolveNotebookTeamClusterId(notebook, input),
                userId,
                notebookId: notebook._id,
                notebook: {
                    notebookPath: notebook.props.notebookPath,
                    content: notebook.props.content
                }
            };
            const session = await this.scriptingSessionOrchestrator.startSession(sessionInput);

            return Result.ok({
                notebookId: notebook._id,
                jupyter: session.jupyter
            });
        } catch (error) {
            return this.mapError(error);
        } finally {
            await lease?.release();
        }
    }

    private async resolveNotebookForSession(
        input: CreateScriptingJupyterSessionInputDTO,
        userId: string
    ): Promise<ScriptingNotebook> {
        if (input.notebookId) {
            const notebook = await this.scriptingNotebookRepository.findByTeamAndNotebookId(input.teamId, input.notebookId);

            if (!notebook) {
                throw new ApplicationError(
                    ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND,
                    'Notebook not found',
                    404
                );
            }

            const now = new Date();
            const updateData: Partial<ScriptingNotebookProps> = {
                lastOpenedAt: now,
                updatedAt: now
            };

            if (input.trajectoryId) {
                const currentPrimaryTrajectoryId = getPrimaryTrajectoryId(notebook);
                if (currentPrimaryTrajectoryId !== input.trajectoryId) {
                    updateData.trajectory = input.trajectoryId;
                }
            }

            const touched = await this.scriptingNotebookRepository.updateById(notebook._id, updateData);

            return touched || notebook;
        }

        if (!input.trajectoryId) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                'Trajectory id or notebook id is required'
            );
        }

        const existingNotebooks = await this.scriptingNotebookRepository.findAllWithTrajectory(input.trajectoryId);
        const existing = selectExistingTrajectoryNotebook(existingNotebooks, input.teamId);

        if (existing) {
            const now = new Date();
            const updateData: Partial<ScriptingNotebookProps> = {
                trajectory: input.trajectoryId,
                lastOpenedAt: now,
                updatedAt: now
            };
            const touched = await this.scriptingNotebookRepository.updateById(existing._id, updateData);

            return touched || existing;
        }

        const notebookContent = await this.scriptingSessionOrchestrator.resolveNotebookTemplateContent({
            trajectoryId: input.trajectoryId
        });
        const teamClusterIdInput = this.requireCreateInputTeamClusterId(input);
        const teamClusterId = await this.teamClusterSelectionService.resolveConnectedClusterId(
            input.teamId,
            teamClusterIdInput
        );
        const now = new Date();
        const createData: ScriptingNotebookProps = {
            team: input.teamId,
            teamCluster: teamClusterId,
            title: DEFAULT_SCRIPTING_NOTEBOOK_TITLE,
            notebookPath: buildScriptingNotebookPath(input.trajectoryId),
            trajectory: input.trajectoryId,
            createdBy: userId,
            content: notebookContent,
            lastOpenedAt: now,
            createdAt: now,
            updatedAt: now
        };

        const notebook = await this.scriptingNotebookRepository.create(createData);

        return notebook;
    }

    private async resolveNotebookTeamClusterId(
        notebook: ScriptingNotebook,
        input: CreateScriptingJupyterSessionInputDTO
    ): Promise<string> {
        const notebookTeamClusterId = getNotebookTeamClusterId(notebook.props.teamCluster);
        if (!notebookTeamClusterId) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                'Notebook deployment cluster is not configured'
            );
        }

        return this.teamClusterSelectionService.resolveConnectedClusterId(
            input.teamId,
            notebookTeamClusterId
        );
    }

    private requireCreateInputTeamClusterId(
        input: CreateScriptingJupyterSessionInputDTO
    ): string {
        if (!input.teamClusterId) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
                'Notebook deployment cluster is required'
            );
        }

        return input.teamClusterId;
    }

    private buildLockKey(input: CreateScriptingJupyterSessionInputDTO): string | null {
        if (input.trajectoryId) {
            return `lock:jupyter:${input.teamId}:trajectory:${input.trajectoryId}`;
        }

        if (input.notebookId) {
            return `lock:jupyter:${input.teamId}:notebook:${input.notebookId}`;
        }

        return null;
    }

    private async resolvePendingNotebookId(input: CreateScriptingJupyterSessionInputDTO): Promise<string> {
        if (input.notebookId) {
            return input.notebookId;
        }

        if (!input.trajectoryId) {
            return '';
        }

        try {
            return await pRetry(async () => {
                const notebooks = await this.scriptingNotebookRepository.findAllWithTrajectory(input.trajectoryId!);
                const existingNotebook = selectExistingTrajectoryNotebook(notebooks, input.teamId);
                if (!existingNotebook) {
                    throw ApplicationError.notFound(
                        ErrorCodes.SCRIPTING_PENDING_NOTEBOOK_NOT_FOUND,
                        'Pending notebook not created yet'
                    );
                }

                return existingNotebook._id;
            }, {
                retries: LOCK_BUSY_WAIT_ATTEMPTS - 1,
                factor: 1,
                minTimeout: LOCK_BUSY_WAIT_DELAY_MS,
                maxTimeout: LOCK_BUSY_WAIT_DELAY_MS,
                shouldRetry: ({ error }) => {
                    return error instanceof ApplicationError
                        && error.code === ErrorCodes.SCRIPTING_PENDING_NOTEBOOK_NOT_FOUND;
                }
            });
        } catch {
            return '';
        }
    }

    private mapError(error: unknown): Result<CreateScriptingJupyterSessionOutputDTO, ApplicationError> {
        if (error instanceof ApplicationError) {
            return Result.fail(error);
        }

        if (error instanceof Error) {
            const isDaemonError = error.message.includes('daemon') ||
                error.message.includes('Daemon') ||
                error.message.includes('Timed out') ||
                error.message.includes('connection was lost');
            const errorCode = isDaemonError
                ? ErrorCodes.SCRIPTING_DAEMON_UNAVAILABLE
                : ErrorCodes.SCRIPTING_SESSION_FAILED;
            const statusCode = isDaemonError ? 502 : 500;

            return Result.fail(new ApplicationError(
                errorCode,
                error.message,
                statusCode
            ));
        }

        return Result.fail(new ApplicationError(
            ErrorCodes.SCRIPTING_SESSION_FAILED,
            'Unexpected scripting error',
            500
        ));
    }
}
