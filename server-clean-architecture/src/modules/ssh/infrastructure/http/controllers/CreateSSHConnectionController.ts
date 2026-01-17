import { injectable, inject, delay } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import { HttpStatus } from "@/src/shared/infrastructure/http/HttpStatus";
import { CreateSSHConnectionUseCase } from "../../../application/use-cases/CreateSSHConnectionUseCase";

@injectable()
export default class CreateSSHConnectionController extends BaseController<CreateSSHConnectionUseCase> {
    constructor(
        @inject(delay(() => CreateSSHConnectionUseCase))
        useCase: CreateSSHConnectionUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
};