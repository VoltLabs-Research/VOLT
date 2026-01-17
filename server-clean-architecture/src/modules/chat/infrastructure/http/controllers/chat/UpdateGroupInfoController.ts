import { injectable, inject, delay } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import { UpdateGroupInfoUseCase } from "@/src/modules/chat/application/use-cases/chat/UpdateGroupInfoUseCase";

@injectable()
export default class UpdateGroupInfoController extends BaseController<UpdateGroupInfoUseCase> {
    constructor(
        @inject(delay(() => UpdateGroupInfoUseCase))
        useCase: UpdateGroupInfoUseCase
    ) {
        super(useCase);
    }
};