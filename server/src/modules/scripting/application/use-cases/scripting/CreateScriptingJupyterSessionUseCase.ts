import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/ports/IScriptingNotebookRepository';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import { JupyterService } from '@modules/scripting/infrastructure/services/JupyterService';
import {
    CreateScriptingJupyterSessionInputDTO,
    CreateScriptingJupyterSessionOutputDTO
} from '@modules/scripting/application/dtos/CreateScriptingJupyterSessionDTO';

@injectable()
export class CreateScriptingJupyterSessionUseCase implements IUseCase<CreateScriptingJupyterSessionInputDTO, CreateScriptingJupyterSessionOutputDTO, ApplicationError> {
    private readonly sessionLocks = new Map<string, Promise<CreateScriptingJupyterSessionOutputDTO>>();

    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository,

        @inject(JupyterService)
        private readonly jupyterService: JupyterService
    ) {}

    async execute(input: CreateScriptingJupyterSessionInputDTO): Promise<Result<CreateScriptingJupyterSessionOutputDTO, ApplicationError>> {
        if (!input.userId) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                ErrorCodes.AUTHENTICATION_REQUIRED
            ));
        }

        return this.runWithLock(
            [input.teamId, input.trajectoryId].join(':'),
            async () => {
                const notebook = await this.resolveNotebookForSession(input);
                const session = await this.jupyterService.startSession({
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    userId: input.userId,
                    notebook: notebook
                        ? {
                            notebookPath: notebook.props.notebookPath,
                            content: notebook.props.content
                        }
                        : undefined
                });

                return {
                    jupyter: session.jupyter
                };
            }
        );
    }

    private async runWithLock(
        lockKey: string,
        factory: () => Promise<CreateScriptingJupyterSessionOutputDTO>
    ): Promise<Result<CreateScriptingJupyterSessionOutputDTO, ApplicationError>> {
        const existingRequest = this.sessionLocks.get(lockKey);
        const requestPromise = existingRequest || factory();

        if (!existingRequest) {
            this.sessionLocks.set(lockKey, requestPromise);
            requestPromise.finally(() => {
                if (this.sessionLocks.get(lockKey) === requestPromise) {
                    this.sessionLocks.delete(lockKey);
                }
            });
        }

        try {
            return Result.ok(await requestPromise);
        } catch (error) {
            return this.mapError(error);
        }
    }

    private async resolveNotebookForSession(input: {
        teamId: string;
        trajectoryId: string;
        notebookId?: string;
    }): Promise<ScriptingNotebook | null> {
        if (!input.notebookId) {
            return null;
        }

        const notebook = await this.scriptingNotebookRepository.findOne({
            _id: input.notebookId,
            team: input.teamId
        } as any);

        if (!notebook) {
            throw new RuntimeError(ErrorCodes.RESOURCE_NOT_FOUND, 404);
        }

        const currentTrajectoryIds = Array.isArray(notebook.props.trajectories)
            ? notebook.props.trajectories.map((trajectory) => String(trajectory))
            : [];
        const nextTrajectoryIds = currentTrajectoryIds.includes(input.trajectoryId)
            ? currentTrajectoryIds
            : Array.from(new Set([...currentTrajectoryIds, input.trajectoryId]));
        const now = new Date();

        const touched = await this.scriptingNotebookRepository.updateById(notebook.id, {
            lastOpenedAt: now,
            updatedAt: now,
            ...(nextTrajectoryIds.length !== currentTrajectoryIds.length
                ? { trajectories: nextTrajectoryIds }
                : {})
        } as any);

        return touched || notebook;
    }

    private mapError(error: unknown): Result<CreateScriptingJupyterSessionOutputDTO, ApplicationError> {
        if (error instanceof ApplicationError) {
            return Result.fail(error);
        }

        if (error instanceof RuntimeError) {
            return Result.fail(new ApplicationError(error.code, error.message, error.statusCode, error.isOperational));
        }

        if (error instanceof Error) {
            return Result.fail(ApplicationError.internalServerError(error.message));
        }

        return Result.fail(ApplicationError.internalServerError('Unexpected scripting error'));
    }
}
