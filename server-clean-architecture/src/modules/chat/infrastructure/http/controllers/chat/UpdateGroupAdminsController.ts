import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import UpdateGroupAdminsUseCase from "@/src/modules/chat/application/use-cases/chat/UpdateGroupAdminsUseCase";

@injectable()
export default class UpdateGroupAdminsController extends BaseController<UpdateGroupAdminsUseCase>{
    constructor(
        useCase: UpdateGroupAdminsUseCase
    ){
        super(useCase);
    }
};