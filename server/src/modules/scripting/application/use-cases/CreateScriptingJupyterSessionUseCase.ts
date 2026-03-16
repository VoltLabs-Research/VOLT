import { buildScriptingNotebookPath, parseScriptingNotebookContent } from '@modules/scripting/application/utilities/build-scripting-notebook';
import {
    CreateScriptingJupyterSessionInputDTO,
    CreateScriptingJupyterSessionOutputDTO
} from '@modules/scripting/application/dtos/CreateScriptingJupyterSessionDTO';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IScriptingSessionLock } from '@modules/scripting/domain/port/IScriptingSessionLock';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type {
    IScriptingSessionOrchestrator,
    ScriptingSessionStartInput
} from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { IUseCase } from '@shared/application/IUseCase';

const LOCK_TTL_MS = 90_000;

const PENDING_JUPYTER_SESSION: CreateScriptingJupyterSessionOutputDTO = {
    notebookId: '',
    jupyter: {
        url: '',
        ready: false
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

        return right.id.localeCompare(left.id);
    })[0] || null;
};

@injectable()
export class CreateScriptingJupyterSessionUseCase implements IUseCase<CreateScriptingJupyterSessionInputDTO, CreateScriptingJupyterSessionOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository,

        @inject(SCRIPTING_TOKENS.ScriptingSessionOrchestrator)
        private readonly scriptingSessionOrchestrator: IScriptingSessionOrchestrator,

        @inject(SCRIPTING_TOKENS.ScriptingSessionLock)
        private readonly scriptingSessionLock: IScriptingSessionLock,

        @inject(TeamClusterSelectionService)
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
                return Result.ok({
                    ...PENDING_JUPYTER_SESSION,
                    notebookId: input.notebookId || ''
                });
            }

            const notebook = await this.resolveNotebookForSession(input, userId);
            const sessionInput: ScriptingSessionStartInput = {
                teamId: input.teamId,
                teamClusterId: await this.resolveNotebookTeamClusterId(notebook, input),
                userId,
                notebookId: notebook.id,
                notebook: {
                    notebookPath: notebook.props.notebookPath,
                    content: notebook.props.content
                }
            };
            const session = await this.scriptingSessionOrchestrator.startSession(sessionInput);

            return Result.ok({
                notebookId: notebook.id,
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

        const templateRaw = await this.scriptingSessionOrchestrator.resolveDefaultNotebookTemplateContent({
            trajectoryId: input.trajectoryId
        });
        const teamClusterId = await this.teamClusterSelectionService.resolveTeamClusterId(
            input.teamId,
            input.teamClusterId
        );
        const now = new Date();
        const createData: ScriptingNotebookProps = {
            team: input.teamId,
            teamCluster: teamClusterId,
            title: 'Scripting Notebook',
            notebookPath: buildScriptingNotebookPath(input.trajectoryId),
            trajectory: input.trajectoryId,
            createdBy: userId,
            content: parseScriptingNotebookContent(templateRaw),
            lastOpenedAt: now,
            createdAt: now,
            updatedAt: now
        };

        return this.scriptingNotebookRepository.create(createData);
    }

    private async resolveNotebookTeamClusterId(
        notebook: ScriptingNotebook,
        input: CreateScriptingJupyterSessionInputDTO
    ): Promise<string> {
        const notebookTeamClusterId = getNotebookTeamClusterId(notebook.props.teamCluster);
        const teamClusterId = await this.teamClusterSelectionService.resolveTeamClusterId(
            input.teamId,
            input.teamClusterId || notebookTeamClusterId
        );
        if (notebookTeamClusterId !== teamClusterId) {
            await this.scriptingNotebookRepository.updateById(notebook._id, {
                teamCluster: teamClusterId,
                runtimeNotebookId: undefined
            });
            notebook.props.teamCluster = teamClusterId;
            notebook.props.runtimeNotebookId = undefined;
        }

        return teamClusterId;
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
};
