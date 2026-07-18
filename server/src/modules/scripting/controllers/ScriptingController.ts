import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser, Req, Res } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/services/ScriptingJupyterAccessTokenService';
import { clearJupyterProxyAccessCookie, setJupyterProxyAccessCookie } from '@modules/scripting/utilities/jupyter-proxy';
import { scriptingRoutes } from '@volt/contracts/modules/scripting/routes';
import { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import type {
    CreateScriptingNotebookInput,
    UpdateScriptingNotebookInput,
    CreateScriptingJupyterSessionInput
} from '@volt/contracts/modules/scripting/http';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';

/**
 * The single HTTP controller for the scripting module (pollium style): every
 * route is bound with `@Route(scriptingRoutes.x)` and delegates to a
 * {@link ScriptingService} the controller `new`s itself. The class-level
 * `@Middleware(protect, teamScoped(Resource.SCRIPTING))` replaces the old
 * mount-time auth + team-scope layer (`basePath /api/scripting/:teamId`,
 * `resource SCRIPTING`). `listNotebooks` and `createJupyterSession` each back two
 * wire routes (with/without the leading `:trajectoryId`). The session handlers
 * (`getSessionStatus`, `deleteSession`, `createJupyterSession`) reproduce the
 * former custom cookie behaviour verbatim: they take `@Res()`, set/clear the
 * Jupyter-proxy access cookie, and write the (cookie-stripped) payload via
 * `BaseResponse` — so the `Controller` base's responder no-ops on its
 * `headersSent` guard. The raw Jupyter HTTP/WS proxy under `/api/jupyter/...`
 * is NOT part of this controller; it stays a separate pass-through router driven
 * by the stateful proxy singleton.
 */
@Middleware(protect, teamScoped(Resource.SCRIPTING))
export default class ScriptingController extends Controller {
    #service = new ScriptingService();
    #accessToken = new ScriptingJupyterAccessTokenService();

    @Route(scriptingRoutes.listNotebooks)
    @Route(scriptingRoutes.listNotebooksByTrajectory)
    listNotebooks(
        @Param('teamId') teamId: string,
        @Param('trajectoryId') trajectoryId: string | undefined,
        @Query() query: Record<string, string>
    ) {
        return this.#service.listNotebooks({
            teamId,
            trajectoryId,
            scope: query.scope as ScriptingNotebookScope | undefined,
            page: query.page !== undefined ? Number(query.page) : undefined,
            limit: query.limit !== undefined ? Number(query.limit) : undefined
        });
    }

    @Route(scriptingRoutes.createNotebook)
    @Status(201)
    createNotebook(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body() body: CreateScriptingNotebookInput
    ) {
        return this.#service.createNotebook({
            teamId,
            userId,
            title: body.title,
            teamClusterId: body.teamClusterId
        });
    }

    @Route(scriptingRoutes.updateNotebook)
    updateNotebook(
        @Param('teamId') teamId: string,
        @Param('notebookId') notebookId: string,
        @Body() body: UpdateScriptingNotebookInput
    ) {
        return this.#service.updateNotebook({
            teamId,
            notebookId,
            title: body.title,
            teamClusterId: body.teamClusterId,
            containerResources: body.containerResources
        });
    }

    @Route(scriptingRoutes.removeNotebook)
    async removeNotebook(@Param('teamId') teamId: string, @Param('notebookId') notebookId: string) {
        await this.#service.deleteNotebook({ teamId, notebookId });
    }

    @Route(scriptingRoutes.getSessionStatus)
    async getSessionStatus(
        @Param('teamId') teamId: string,
        @Param('notebookId') notebookId: string,
        @CurrentUser() userId: string,
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void> {
        const value = await this.#service.getSessionStatus({ teamId, notebookId, userId });
        const { runtimeNotebookId, accessToken, ...response } = value;

        if (runtimeNotebookId && accessToken && teamId) {
            setJupyterProxyAccessCookie(req, res, accessToken, teamId, runtimeNotebookId, this.#accessToken.getCookieMaxAgeMs());
        }

        BaseResponse.success(res, response);
    }

    @Route(scriptingRoutes.deleteSession)
    async deleteSession(
        @Param('teamId') teamId: string,
        @Param('notebookId') notebookId: string,
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void> {
        const value = await this.#service.deleteSession({ teamId, notebookId });
        const { runtimeNotebookId, ...response } = value;

        if (runtimeNotebookId && teamId) {
            clearJupyterProxyAccessCookie(req, res, teamId, runtimeNotebookId);
        }

        BaseResponse.success(res, response);
    }

    @Route(scriptingRoutes.createJupyterSession)
    @Route(scriptingRoutes.createJupyterSessionByTrajectory)
    async createJupyterSession(
        @Param('teamId') teamId: string,
        @Param('trajectoryId') trajectoryIdParam: string | undefined,
        @CurrentUser() userId: string,
        @Body() body: CreateScriptingJupyterSessionInput,
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void> {
        const value = await this.#service.createJupyterSession({
            teamId,
            userId,
            notebookId: body.notebookId,
            trajectoryId: body.trajectoryId ?? trajectoryIdParam,
            teamClusterId: body.teamClusterId
        });

        if (value.jupyter.url && teamId && userId && value.notebookId) {
            const accessToken = this.#accessToken.create({
                teamId,
                runtimeNotebookId: value.notebookId,
                userId
            });
            setJupyterProxyAccessCookie(req, res, accessToken, teamId, value.notebookId, this.#accessToken.getCookieMaxAgeMs());
        }

        BaseResponse.success(res, value, 201);
    }
}
