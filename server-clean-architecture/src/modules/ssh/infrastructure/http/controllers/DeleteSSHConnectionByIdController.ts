import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import { HttpStatus } from "@/src/shared/infrastructure/http/HttpStatus";
import DeleteSSHConnectionByIdUseCase from "../../../application/use-cases/DeleteSSHConnectionByIdUseCase";

@injectable()
export default class DeleteSSHConnectionByIdController extends BaseController<DeleteSSHConnectionByIdUseCase>{
    constructor(
        useCase: DeleteSSHConnectionByIdUseCase
    ){
        super(useCase, HttpStatus.Deleted);
    }
};