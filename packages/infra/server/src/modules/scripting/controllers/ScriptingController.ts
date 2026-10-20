import typia from 'typia';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, schemaBody, Param, Query, CurrentUser, Req, Res } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import scriptingService from '@modules/scripting/services/ScriptingService';
import scriptingSessionService from '@modules/scripting/services/ScriptingSessionService';
import { clearJupyterProxyAccessCookie, setJupyterProxyAccessCookie } from '@modules/scripting/services/ScriptingJupyterProxySupport';
import { scriptingRoutes } from '@volt/contracts/modules/scripting/routes';
import { type ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import type {
    CreateScriptingNotebookInput,
    UpdateScriptingNotebookInput,
    CreateScriptingJupyterSessionInput
} from '@volt/contracts/modules/scripting/http';
import BaseResponse from '@shared/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import type { Response } from 'express';

@Middleware(protect, teamScoped(Resource.SCRIPTING))
export default class ScriptingController extends Controller {
    @Route(scriptingRoutes.listNotebooks)
    listNotebooks(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>
    ) {
        return scriptingService.listNotebooks({
            teamId,
            trajectoryId: query.trajectoryId,
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
        @Body(schemaBody(typia.createValidate<CreateScriptingNotebookInput>())) body: CreateScriptingNotebookInput
    ) {
        return scriptingService.createNotebook({
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
        @Body(schemaBody(typia.createValidate<UpdateScriptingNotebookInput>())) body: UpdateScriptingNotebookInput
    ) {
        return scriptingService.updateNotebook({
            teamId,
            notebookId,
            title: body.title,
            teamClusterId: body.teamClusterId,
            containerResources: body.containerResources
        });
    }

    @Route(scriptingRoutes.removeNotebook)
    async removeNotebook(
        @Param('teamId') teamId: string,
        @Param('notebookId') notebookId: string
    ){
        await scriptingService.deleteNotebook({
            teamId,
            notebookId
        });
    }

    @Route(scriptingRoutes.getSessionStatus)
    async getSessionStatus(
        @Param('teamId') teamId: string,
        @Param('notebookId') notebookId: string,
        @CurrentUser() userId: string,
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void> {
        const value = await scriptingSessionService.getSessionStatus({
            teamId,
            notebookId,
            userId
        });
        const { accessGrant, ...response } = value;

        if (accessGrant) {
            setJupyterProxyAccessCookie(req, res, accessGrant);
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
        const value = await scriptingSessionService.deleteSession({
            teamId,
            notebookId
        });
        const { runtimeNotebookId, ...response } = value;

        if (runtimeNotebookId) {
            clearJupyterProxyAccessCookie(req, res, teamId, runtimeNotebookId);
        }

        BaseResponse.success(res, response);
    }

    @Route(scriptingRoutes.createJupyterSession)
    async createJupyterSession(
        @Param('teamId') teamId: string,
        @CurrentUser() userId: string,
        @Body(schemaBody(typia.createValidate<CreateScriptingJupyterSessionInput>())) body: CreateScriptingJupyterSessionInput,
        @Req() req: AuthenticatedRequest,
        @Res() res: Response
    ): Promise<void> {
        const value = await scriptingSessionService.createJupyterSession({
            teamId,
            userId,
            notebookId: body.notebookId,
            trajectoryId: body.trajectoryId,
            teamClusterId: body.teamClusterId
        });

        const { accessGrant, ...response } = value;
        if (accessGrant) {
            setJupyterProxyAccessCookie(req, res, accessGrant);
        }

        BaseResponse.success(res, response, 201);
    }
}
