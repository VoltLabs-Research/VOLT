import { injectable, inject, delay } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import { TestSSHConnectionsByIdUseCase } from "../../../application/use-cases/TestSSHConnectionsByIdUseCase";

@injectable()
export default class TestSSHConnectionsByIdController extends BaseController<TestSSHConnectionsByIdUseCase> {
    constructor(
        @inject(delay(() => TestSSHConnectionsByIdUseCase))
        useCase: TestSSHConnectionsByIdUseCase
    ) {
        super(useCase);
    }
};