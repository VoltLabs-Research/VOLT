import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import RemoveUsersFromGroupUseCase from "@/src/modules/chat/application/use-cases/chat/RemoveUsersFromGroupUseCase";

@injectable()
export default class RemoveUsersFromGroupController extends BaseController<RemoveUsersFromGroupUseCase>{
    constructor(
        useCase: RemoveUsersFromGroupUseCase
    ){
        super(useCase);
    }
};