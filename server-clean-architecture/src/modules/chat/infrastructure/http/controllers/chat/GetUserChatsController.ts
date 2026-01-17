import { injectable, inject, delay } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import { GetUserChatsUseCase } from "@/src/modules/chat/application/use-cases/chat/GetUserChatsUseCase";

@injectable()
export default class GetUserChatsController extends BaseController<GetUserChatsUseCase> {
    constructor(
        @inject(delay(() => GetUserChatsUseCase))
        useCase: GetUserChatsUseCase
    ) {
        super(useCase);
    }
};