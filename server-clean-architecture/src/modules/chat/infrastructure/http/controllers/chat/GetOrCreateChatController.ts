import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import GetOrCreateChatUseCase from "@/src/modules/chat/application/use-cases/chat/GetOrCreateChatUseCase";

@injectable()
export default class GetOrCreateChatController extends BaseController<GetOrCreateChatUseCase>{
    constructor(
        useCase: GetOrCreateChatUseCase
    ){
        super(useCase);
    }
};