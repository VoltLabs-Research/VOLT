import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser, Req, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import { clearJupyterProxyAccessCookie, setJupyterProxyAccessCookie } from '@modules/scripting/services/ScriptingJupyterProxySupport';
import { scriptingRoutes } from '@volt/contracts/modules/scripting/routes';
import { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import type {
    CreateScriptingNotebookInput,
    UpdateScriptingNotebookInput,
    CreateScriptingJupyterSessionInput
} from '@volt/contracts/modules/scripting/http';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';

@Middleware(protect, teamScoped(Resource.SCRIPTING))
export default class ScriptingController extends Controller {
    #service = new ScriptingService();

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
        const { accessGrant, ...response } = value;

        if (accessGrant) {
            setJupyterProxyAccessCookie(
                req,
                res,
                accessGrant.token,
                accessGrant.teamId,
                accessGrant.runtimeNotebookId,
                accessGrant.maxAgeMs
            );
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

        const { accessGrant, ...response } = value;
        if (accessGrant) {
            setJupyterProxyAccessCookie(
                req,
                res,
                accessGrant.token,
                accessGrant.teamId,
                accessGrant.runtimeNotebookId,
                accessGrant.maxAgeMs
            );
        }

        BaseResponse.success(res, response, 201);
    }
}
