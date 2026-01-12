import { injectable } from "tsyringe";
import { BaseController } from "@/src/shared/infrastructure/http/BaseController";
import DeleteAnalysisByIdUseCase from "../../../application/use-cases/DeleteAnalysisByIdUseCase";
import { HttpStatus } from "@/src/shared/infrastructure/http/HttpStatus";

@injectable()
export default class DeleteAnalysisByIdController extends BaseController<DeleteAnalysisByIdUseCase>{
    constructor(
        useCase: DeleteAnalysisByIdUseCase
    ){
        super(useCase, HttpStatus.Deleted);
    }
};