import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import LeaveGroupUseCase from "@/src/modules/chat/application/use-cases/chat/LeaveGroupUseCase";
import { LeaveGroupInputDTO } from "@/src/modules/chat/application/dtos/chat/LeaveGroupDTO";
import { AuthenticatedRequest } from "@/src/shared/infrastructure/http/middleware/authentication";

@injectable()
export default class LeaveGroupController extends BaseController<LeaveGroupUseCase>{
    constructor(
        useCase: LeaveGroupUseCase
    ){
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): LeaveGroupInputDTO {
        const { chatId } = req.params;
        return {
            chatId,
            participantId: req.userId!
        };
    }
};