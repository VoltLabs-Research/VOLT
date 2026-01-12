import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import UpdateSSHConnectionByIdUseCase from "../../../application/use-cases/UpdateSSHConnectionByIdUseCase";

@injectable()
export default class UpdateSSHConnectionByIdController extends BaseController<UpdateSSHConnectionByIdUseCase>{
    constructor(
        useCase: UpdateSSHConnectionByIdUseCase
    ){
        super(useCase);
    }
};