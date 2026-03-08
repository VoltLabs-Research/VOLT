import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { SCRIPTING_TOKENS } from '@modules/scripting/application/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type {
    IScriptingSessionOrchestrator,
    ScriptingSessionStartInput
} from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { IScriptingSessionLock } from '@modules/scripting/application/port/IScriptingSessionLock';
import {
    CreateScriptingJupyterSessionInputDTO,
    CreateScriptingJupyterSessionOutputDTO
} from '@modules/scripting/application/dtos/CreateScriptingJupyterSessionDTO';

const LOCK_TTL_MS = 30_000;

@injectable()
export class CreateScriptingJupyterSessionUseCase implements IUseCase<CreateScriptingJupyterSessionInputDTO, CreateScriptingJupyterSessionOutputDTO, ApplicationError> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository,

        @inject(SCRIPTING_TOKENS.ScriptingSessionOrchestrator)
        private readonly scriptingSessionOrchestrator: IScriptingSessionOrchestrator,

        @inject(SCRIPTING_TOKENS.ScriptingSessionLock)
        private readonly scriptingSessionLock: IScriptingSessionLock
    ) {}

    async execute(input: CreateScriptingJupyterSessionInputDTO): Promise<Result<CreateScriptingJupyterSessionOutputDTO, ApplicationError>> {
        if (!input.userId) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                ErrorCodes.AUTHENTICATION_REQUIRED
            ));
        }

        const lockKey = `lock:jupyter:${input.teamId}:${input.trajectoryId}`;
        const lease = await this.scriptingSessionLock.acquire(lockKey, LOCK_TTL_MS);
        if (!lease) {
            return Result.fail(ApplicationError.conflict(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Session creation already in progress'
            ));
        }

        try {
            const notebook = await this.resolveNotebookForSession(input);
            const sessionInput: ScriptingSessionStartInput = {
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                userId: input.userId,
                notebook: {
                    notebookPath: notebook.props.notebookPath,
                    content: notebook.props.content
                }
            };
            const session = await this.scriptingSessionOrchestrator.startSession(sessionInput);

            return Result.ok({
                jupyter: session.jupyter
            });
        } catch (error) {
            return this.mapError(error);
        } finally {
            await lease.release();
        }
    }

    private async resolveNotebookForSession(input: {
        teamId: string;
        trajectoryId: string;
        userId?: string;
        notebookId?: string;
    }): Promise<ScriptingNotebook> {
        if (input.notebookId) {
            const notebook = await this.scriptingNotebookRepository.findOne({
                _id: input.notebookId,
                team: input.teamId
            } as any);

            if (!notebook) {
                throw new ApplicationError(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Notebook not found',
                    404
                );
            }

            const currentTrajectoryIds = Array.isArray(notebook.props.trajectories)
                ? notebook.props.trajectories.map((trajectory) => String(trajectory))
                : [];
            const nextTrajectoryIds = currentTrajectoryIds.includes(input.trajectoryId)
                ? currentTrajectoryIds
                : Array.from(new Set([...currentTrajectoryIds, input.trajectoryId]));
            const now = new Date();

            const touched = await this.scriptingNotebookRepository.updateById(notebook._id, {
                lastOpenedAt: now,
                updatedAt: now,
                ...(nextTrajectoryIds.length !== currentTrajectoryIds.length
                    ? { trajectories: nextTrajectoryIds }
                    : {})
            } as any);

            return touched || notebook;
        }

        const existing = await this.scriptingNotebookRepository.findOne({
            team: input.teamId,
            trajectories: input.trajectoryId
        } as any);

        if (existing) {
            const now = new Date();
            const touched = await this.scriptingNotebookRepository.updateById(existing._id, {
                lastOpenedAt: now,
                updatedAt: now
            } as any);
            return touched || existing;
        }

        const notebookPath = `scripting-notebook-${input.trajectoryId}.ipynb`;
        const templateRaw = await this.scriptingSessionOrchestrator.resolveDefaultNotebookTemplateContent({
            trajectoryId: input.trajectoryId
        });

        return this.scriptingNotebookRepository.create({
            team: input.teamId,
            title: 'Scripting Notebook',
            notebookPath,
            trajectories: [input.trajectoryId],
            createdBy: input.userId,
            content: JSON.parse(templateRaw),
            lastOpenedAt: new Date()
        } as any);
    }

    private mapError(error: unknown): Result<CreateScriptingJupyterSessionOutputDTO, ApplicationError> {
        if (error instanceof ApplicationError) {
            return Result.fail(error);
        }

        if (error instanceof Error) {
            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                error.message,
                500
            ));
        }

        return Result.fail(new ApplicationError(
            ErrorCodes.INTERNAL_SERVER_ERROR,
            'Unexpected scripting error',
            500
        ));
    }
}
