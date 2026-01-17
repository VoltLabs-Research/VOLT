import { injectable, inject } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import GetAnalysisByIdUseCase from "../../../application/use-cases/GetAnalysisByIdUseCase";

@injectable()
export default class GetAnalysisByIdController extends BaseController<GetAnalysisByIdUseCase> {
    constructor(
        @inject(GetAnalysisByIdUseCase) useCase: GetAnalysisByIdUseCase
    ) {
        super(useCase);
    }
};