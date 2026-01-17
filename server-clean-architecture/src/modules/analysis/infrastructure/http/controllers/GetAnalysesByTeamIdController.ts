import { injectable, inject } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import GetAnalysesByTeamIdUseCase from "../../../application/use-cases/GetAnalysesByTeamIdUseCase";

@injectable()
export default class GetAnalysesByTeamIdController extends BaseController<GetAnalysesByTeamIdUseCase> {
    constructor(
        @inject(GetAnalysesByTeamIdUseCase) useCase: GetAnalysesByTeamIdUseCase
    ) {
        super(useCase);
    }
};