import type AiService from '@modules/ai/application/AiService';
import type { CreateAIConversationInputDTO } from '@modules/ai/application/dtos/CreateAIConversationDTO';
import type { DeleteAIConversationInputDTO } from '@modules/ai/application/dtos/DeleteAIConversationDTO';
import type { ListAIConversationMessagesInputDTO } from '@modules/ai/application/dtos/ListAIConversationMessagesDTO';
import type { ListAIConversationsInputDTO } from '@modules/ai/application/dtos/ListAIConversationsDTO';
import type { SendAIConversationMessageInputDTO } from '@modules/ai/application/dtos/SendAIConversationMessageDTO';
import type { UpdateAIConversationInputDTO } from '@modules/ai/application/dtos/UpdateAIConversationDTO';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the ai module. One Express handler per route,
 * assembling the use-case input exactly as `buildControllerParams` did for the
 * generated controllers, delegating to {@link AiService}, and responding via
 * {@link BaseResponse}. Handlers are arrow-function properties so `this` stays
 * bound when passed by reference to the router. Thrown `ApplicationError`s
 * propagate to `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class AiController {
    constructor(
        @inject(AI_TOKENS.AiService) private readonly aiService: AiService
    ) {}

    listConversations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ListAIConversationsInputDTO;
        const value = await this.aiService.listConversations(input);
        BaseResponse.paginated(res, value, value._meta);
    };

    createConversation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreateAIConversationInputDTO;
        const value = await this.aiService.createConversation(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    listMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ListAIConversationMessagesInputDTO;
        const value = await this.aiService.listMessages(input);
        BaseResponse.paginated(res, value, value._meta);
    };

    streamMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as SendAIConversationMessageInputDTO;
        const value = await this.aiService.streamMessage(input);
        value.streamResult.pipeToResponse(res);
    };

    updateConversation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdateAIConversationInputDTO;
        const value = await this.aiService.updateConversation(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteConversation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteAIConversationInputDTO;
        await this.aiService.deleteConversation(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };
}
