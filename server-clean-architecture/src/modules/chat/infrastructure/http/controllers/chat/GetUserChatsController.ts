import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import GetUserChatsUseCase from "@/src/modules/chat/application/use-cases/chat/GetUserChatsUseCase";

@injectable()
export default class GetUserChatsController extends BaseController<GetUserChatsUseCase>{
    constructor(
        useCase: GetUserChatsUseCase
    ){
        super(useCase);
    }
};