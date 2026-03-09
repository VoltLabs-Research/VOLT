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

interface ResolveNotebookForSessionInput extends CreateScriptingJupyterSessionInputDTO {
    userId: string;
};

const isNotebookContent = (value: unknown): value is Record<string, unknown> => {
    return !!value && !Array.isArray(value) && typeof value === 'object';
};

const LOCK_TTL_MS = 30_000;

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

        const lockKey = `lock:jupyter:${input.teamId}:${input.trajectoryId}`;
        const lease = await this.scriptingSessionLock.acquire(lockKey, LOCK_TTL_MS);
        if (!lease) {
            return Result.fail(ApplicationError.conflict(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Session creation already in progress'
            ));
        }

        try {
            const resolvedInput: ResolveNotebookForSessionInput = {
                ...input,
                userId: input.userId
            };
            const notebook = await this.resolveNotebookForSession(resolvedInput);
            const sessionInput: ScriptingSessionStartInput = {
                teamId: resolvedInput.teamId,
                teamClusterId: await this.resolveNotebookTeamClusterId(notebook, resolvedInput),
                trajectoryId: resolvedInput.trajectoryId,
                userId: resolvedInput.userId,
                notebookId: notebook.id,
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

    private async resolveNotebookForSession(input: ResolveNotebookForSessionInput): Promise<ScriptingNotebook> {
        if (input.notebookId) {
            const notebook = await this.scriptingNotebookRepository.findByTeamAndNotebookId(input.teamId, input.notebookId);

            if (!notebook) {
                throw new ApplicationError(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Notebook not found',
                    404
                );
            }

            let currentTrajectoryIds: string[] = [];
            if (Array.isArray(notebook.props.trajectories)) {
                currentTrajectoryIds = notebook.props.trajectories.map(String);
            }

            let nextTrajectoryIds = currentTrajectoryIds;
            if (!currentTrajectoryIds.includes(input.trajectoryId)) {
                nextTrajectoryIds = Array.from(new Set([...currentTrajectoryIds, input.trajectoryId]));
            }

            const now = new Date();
            const updateData: Partial<ScriptingNotebookProps> = {
                lastOpenedAt: now,
                updatedAt: now
            };

            if (nextTrajectoryIds.length !== currentTrajectoryIds.length) {
                updateData.trajectories = nextTrajectoryIds;
            }

            const touched = await this.scriptingNotebookRepository.updateById(notebook._id, updateData);

            return touched || notebook;
        }

        const existing = await this.scriptingNotebookRepository.findByTeamAndTrajectory(input.teamId, input.trajectoryId);

        if (existing) {
            const now = new Date();
            const updateData: Partial<ScriptingNotebookProps> = {
                lastOpenedAt: now,
                updatedAt: now
            };
            const touched = await this.scriptingNotebookRepository.updateById(existing._id, updateData);

            return touched || existing;
        }

        const notebookPath = `scripting-notebook-${input.trajectoryId}.ipynb`;
        const templateRaw = await this.scriptingSessionOrchestrator.resolveDefaultNotebookTemplateContent({
            trajectoryId: input.trajectoryId
        });
        const createData: Partial<ScriptingNotebookProps> = {
            team: input.teamId,
            teamCluster: input.teamClusterId,
            title: 'Scripting Notebook',
            notebookPath,
            trajectories: [input.trajectoryId],
            createdBy: input.userId,
            content: this.parseNotebookContent(templateRaw),
            lastOpenedAt: new Date()
        };

        return this.scriptingNotebookRepository.create(createData);
    }

    private async resolveNotebookTeamClusterId(
        notebook: ScriptingNotebook,
        input: ResolveNotebookForSessionInput
    ): Promise<string> {
        const teamClusterId = await this.teamClusterSelectionService.resolveTeamClusterId(input.teamId, input.teamClusterId || notebook.props.teamCluster);
        if (notebook.props.teamCluster !== teamClusterId) {
            await this.scriptingNotebookRepository.updateById(notebook._id, {
                teamCluster: teamClusterId,
                runtimeNotebookId: undefined
            });
            notebook.props.teamCluster = teamClusterId;
            notebook.props.runtimeNotebookId = undefined;
        }

        return teamClusterId;
    }

    private parseNotebookContent(templateRaw: string): Record<string, unknown> {
        const parsedTemplate: unknown = JSON.parse(templateRaw);

        if (!isNotebookContent(parsedTemplate)) {
            throw new ApplicationError(
                ErrorCodes.RESOURCE_LOAD_ERROR,
                'Default notebook template content must be an object',
                500
            );
        }

        return parsedTemplate;
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
};
