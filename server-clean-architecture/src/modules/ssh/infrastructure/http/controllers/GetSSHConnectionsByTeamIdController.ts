import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import TestSSHConnectionsByIdUseCase from "../../../application/use-cases/TestSSHConnectionsByIdUseCase";

@injectable()
export default class GetSSHConnectionsByTeamIdController extends BaseController<TestSSHConnectionsByIdUseCase>{
    constructor(
        useCase: TestSSHConnectionsByIdUseCase
    ){
        super(useCase);
    }
};