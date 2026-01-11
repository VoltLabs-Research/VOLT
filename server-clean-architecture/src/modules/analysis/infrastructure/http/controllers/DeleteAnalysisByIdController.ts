import { Response } from "express";
import { injectable } from "tsyringe";
import BaseResponse from "@/src/shared/infrastructure/http/BaseResponse";
import { AuthenticatedRequest } from "@/src/shared/infrastructure/http/middleware/authentication";
import DeleteAnalysisByIdUseCase from "../../../application/use-cases/DeleteAnalysisByIdUseCase";

@injectable()
export default class DeleteAnalysisByIdController{
    constructor(
        private useCase: DeleteAnalysisByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { analysisId } = req.params;
        const result = await this.useCase.execute({ analysisId });
        // TODO: implement a "httpResultHandler"
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }
        BaseResponse.success(res, null, 204);
    }
};