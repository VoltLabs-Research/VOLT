import { injectable, inject, delay } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import { UpdateSSHConnectionByIdUseCase } from "../../../application/use-cases/UpdateSSHConnectionByIdUseCase";

@injectable()
export default class UpdateSSHConnectionByIdController extends BaseController<UpdateSSHConnectionByIdUseCase> {
    constructor(
        @inject(delay(() => UpdateSSHConnectionByIdUseCase))
        useCase: UpdateSSHConnectionByIdUseCase
    ) {
        super(useCase);
    }
};