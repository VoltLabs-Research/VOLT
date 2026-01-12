import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import UpdateGroupInfoUseCase from "@/src/modules/chat/application/use-cases/chat/UpdateGroupInfoUseCase";

@injectable()
export default class UpdateGroupInfoController extends BaseController<UpdateGroupInfoUseCase>{
    constructor(
        useCase: UpdateGroupInfoUseCase
    ){
        super(useCase);
    }
};