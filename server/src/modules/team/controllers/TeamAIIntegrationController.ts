import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, CurrentUser } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import TeamAIIntegrationService from '@modules/team/services/TeamAIIntegrationService';
import { teamAIIntegrationRoutes } from '@volt/contracts/modules/team/routes';
import type { TeamAIIntegrationMutationInput } from '@volt/contracts/modules/team/http';

/**
 * HTTP controller for the team ai-integration resource. Class-level guards
 * reproduce the former `teamScope: BasePath` + `resource: TEAM` (the AI
 * integration routes were guarded by the generic TEAM resource, not a dedicated
 * one). `createByProvider` keeps 201, `deleteByProvider` 204.
 */
@Middleware(protect, teamScoped(Resource.TEAM))
export default class TeamAIIntegrationController extends Controller {
    #service = new TeamAIIntegrationService();

    @Route(teamAIIntegrationRoutes.listModels)
    listModels(@Param('teamId') teamId: string) {
        return this.#service.listModels(teamId);
    }

    @Route(teamAIIntegrationRoutes.list)
    listByTeamId(@Param('teamId') teamId: string) {
        return this.#service.listByTeamId(teamId);
    }

    @Route(teamAIIntegrationRoutes.createByProvider)
    @Status(201)
    createByProvider(@Param('teamId') teamId: string, @Param('provider') provider: string, @CurrentUser() userId: string, @Body() body: TeamAIIntegrationMutationInput) {
        return this.#service.createByProvider(teamId, userId, provider, body);
    }

    @Route(teamAIIntegrationRoutes.updateByProvider)
    updateByProvider(@Param('teamId') teamId: string, @Param('provider') provider: string, @Body() body: TeamAIIntegrationMutationInput) {
        return this.#service.updateByProvider(teamId, provider, body);
    }

    @Route(teamAIIntegrationRoutes.deleteByProvider)
    async deleteByProvider(@Param('teamId') teamId: string, @Param('provider') provider: string) {
        await this.#service.deleteByProvider(teamId, provider);
    }
}
