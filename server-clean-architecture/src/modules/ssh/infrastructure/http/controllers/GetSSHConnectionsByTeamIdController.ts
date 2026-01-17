import { injectable, inject, delay } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import { GetSSHConnectionsByTeamIdUseCase } from "../../../application/use-cases/GetSSHConnectionsByTeamIdUseCase";

@injectable()
export default class GetSSHConnectionsByTeamIdController extends BaseController<GetSSHConnectionsByTeamIdUseCase> {
    constructor(
        @inject(delay(() => GetSSHConnectionsByTeamIdUseCase)) useCase: GetSSHConnectionsByTeamIdUseCase
    ) {
        super(useCase);
    }
};