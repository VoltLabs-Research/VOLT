import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import CreateGroupChatUseCase from "@/src/modules/chat/application/use-cases/chat/CreateGroupChatUseCase";
import { CreateGroupChatInputDTO } from "@/src/modules/chat/application/dtos/chat/CreateGroupChatDTO";
import { AuthenticatedRequest } from "@/src/shared/infrastructure/http/middleware/authentication";

@injectable()
export default class CreateGroupChatController extends BaseController<CreateGroupChatUseCase>{
    constructor(
        useCase: CreateGroupChatUseCase
    ){
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): CreateGroupChatInputDTO {
        const { teamId } = req.params;
        const { groupName, groupDescription, participantIds } = req.body;
        return {
            ownerId: req.userId!,
            teamId,
            groupName,
            groupDescription,
            participantIds
        };
    }
};