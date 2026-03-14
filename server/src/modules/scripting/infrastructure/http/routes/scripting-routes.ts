import { Resource } from '@core/constants/resources';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import scriptingControllers from '@modules/scripting/infrastructure/http/controllers';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { container } from 'tsyringe';
import type { NextFunction, Request, Response } from 'express';

const scriptingNotebookRepository = container.resolve<IScriptingNotebookRepository>(SCRIPTING_TOKENS.ScriptingNotebookRepository);
const teamClusterDaemonClient = container.resolve(TeamClusterDaemonClient);

interface ScriptingSessionStatusInput {
    teamId: string;
    trajectoryId?: string;
    notebookId?: string;
};

interface ScriptingSessionStatusRouteParams {
    teamId?: string | string[];
    trajectoryId?: string | string[];
    notebookId?: string | string[];
};

const normalizeRouteParam = (
    value: string | string[] | undefined,
    fieldName: string,
    required = false
): string | undefined => {
    if (value === undefined) {
        if (required) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `${fieldName} route parameter is required`
            );
        }

        return undefined;
    }

    const normalizedValue = Array.isArray(value)
        ? value.length === 1
            ? value[0]
            : undefined
        : value;

    if (!normalizedValue) {
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            `${fieldName} route parameter must be a single non-empty string`
        );
    }

    const trimmedValue = normalizedValue.trim();

    if (!trimmedValue) {
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            `${fieldName} route parameter must be a single non-empty string`
        );
    }

    return trimmedValue;
};

const requireRouteParam = (
    value: string | string[] | undefined,
    fieldName: string
): string => {
    const normalizedValue = normalizeRouteParam(value, fieldName, true);

    if (normalizedValue === undefined) {
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            `${fieldName} route parameter is required`
        );
    }

    return normalizedValue;
};

const getScriptingSessionStatusInput = (
    params: ScriptingSessionStatusRouteParams
): ScriptingSessionStatusInput => ({
    teamId: requireRouteParam(params.teamId, 'teamId'),
    trajectoryId: normalizeRouteParam(params.trajectoryId, 'trajectoryId'),
    notebookId: normalizeRouteParam(params.notebookId, 'notebookId')
});

const readScriptingSessionStatus = async (input: ScriptingSessionStatusInput) => {
    const notebook = input.notebookId
        ? await scriptingNotebookRepository.findByTeamAndNotebookId(input.teamId, input.notebookId)
        : await scriptingNotebookRepository.findByTeamAndTrajectory(input.teamId, input.trajectoryId || '');

    if (!notebook) {
        throw ApplicationError.notFound(
            ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND,
            'Notebook not found'
        );
    }

    if (!notebook.props.teamCluster || !notebook.props.runtimeNotebookId) {
        return {
            notebookId: notebook.id,
            jupyter: {
                ready: false
            }
        };
    }

    const { runtime } = await teamClusterDaemonClient.getNotebookRuntime(
        notebook.props.teamCluster,
        notebook.props.runtimeNotebookId
    );

    return {
        notebookId: notebook.id,
        jupyter: {
            ready: Boolean(runtime)
        }
    };
};

const handleScriptingSessionStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const status = await readScriptingSessionStatus(
            getScriptingSessionStatusInput(req.params)
        );

        res.json(status);
    } catch (error) {
        next(error);
    }
};

export default createHttpModule({
    basePath: '/api/scripting/:teamId',
    resource: Resource.SCRIPTING,
    routes: (router) => {
        router.get('/notebooks', scriptingControllers.listNotebooks.handle);
        router.post('/notebooks', scriptingControllers.createNotebook.handle);
        router.patch('/notebooks/:notebookId', scriptingControllers.updateNotebook.handle);
        router.get('/:trajectoryId/notebooks', scriptingControllers.listNotebooks.handle);
        router.get('/sessions/:notebookId/status', RATE_LIMIT_POLICIES.scriptingSessionStatus, handleScriptingSessionStatus);
        router.get('/:trajectoryId/sessions/status', RATE_LIMIT_POLICIES.scriptingSessionStatus, handleScriptingSessionStatus);
        router.post('/sessions', RATE_LIMIT_POLICIES.scriptingSessionCreate, scriptingControllers.createNotebookJupyterSession.handle);
        router.post('/:trajectoryId/sessions', RATE_LIMIT_POLICIES.scriptingSessionCreate, scriptingControllers.createJupyterSession.handle);
        router.delete('/notebooks/:notebookId', scriptingControllers.deleteNotebook.handle);
    }
});
