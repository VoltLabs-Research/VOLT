import { injectable, inject, delay } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import { CreateGroupChatUseCase } from "@/src/modules/chat/application/use-cases/chat/CreateGroupChatUseCase";
import { CreateGroupChatInputDTO } from "@/src/modules/chat/application/dtos/chat/CreateGroupChatDTO";
import { AuthenticatedRequest } from "@/src/shared/infrastructure/http/middleware/authentication";

@injectable()
export default class CreateGroupChatController extends BaseController<CreateGroupChatUseCase> {
    constructor(
        @inject(delay(() => CreateGroupChatUseCase))
        useCase: CreateGroupChatUseCase
    ) {
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): CreateGroupChatInputDTO {
        const { teamId, chatId } = req.params; // Assuming chatId comes from req.params
        const { groupName, groupDescription, participantIds } = req.body;
        return {
            ownerId: req.userId!,
            teamId: String(teamId),
            groupName,
            groupDescription,
            participantIds
        };
    }
};