import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
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
                    notebook: {
                        notebookPath: notebook.props.notebookPath,
                        content: notebook.props.content
                    }
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
        userId?: string;
        notebookId?: string;
    }): Promise<ScriptingNotebook> {
        if (input.notebookId) {
            const notebook = await this.scriptingNotebookRepository.findOne({
                _id: input.notebookId,
                team: input.teamId
            } as any);

            if (!notebook) {
                throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, 404);
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

        const existing = await this.scriptingNotebookRepository.findOne({
            team: input.teamId,
            trajectories: input.trajectoryId
        } as any);

        if (existing) {
            const now = new Date();
            const touched = await this.scriptingNotebookRepository.updateById(existing.id, {
                lastOpenedAt: now,
                updatedAt: now
            } as any);
            return touched || existing;
        }

        const notebookPath = `scripting-notebook-${input.trajectoryId}.ipynb`;
        const templateRaw = this.jupyterService.resolveDefaultNotebookTemplateContent({
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
            return Result.fail(ApplicationError.internalServerError(error.message));
        }

        return Result.fail(ApplicationError.internalServerError('Unexpected scripting error'));
    }
}
