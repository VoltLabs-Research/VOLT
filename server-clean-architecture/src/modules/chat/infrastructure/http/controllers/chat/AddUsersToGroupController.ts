import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import AddUsersToGroupUseCase from "@/src/modules/chat/application/use-cases/chat/AddUsersToGroupUseCase";

@injectable()
export default class AddUsersToGroupController extends BaseController<AddUsersToGroupUseCase>{
    constructor(
        useCase: AddUsersToGroupUseCase
    ){
        super(useCase);
    }
};