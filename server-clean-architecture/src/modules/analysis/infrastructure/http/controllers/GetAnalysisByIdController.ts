import { Response } from "express";
import { injectable } from "tsyringe";
import BaseResponse from "@/src/shared/infrastructure/http/BaseResponse";
import { AuthenticatedRequest } from "@/src/shared/infrastructure/http/middleware/authentication";
import GetAnalysisByIdUseCase from "../../../application/use-cases/GetAnalysisByIdUseCase";

@injectable()
export default class GetAnalysisByIdController{
    constructor(
        private useCase: GetAnalysisByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { analysisId } = req.params;
        const result = await this.useCase.execute({ analysisId });
        if(!result.success){
            return BaseResponse.error(res, result.error.message, result.error.statusCode);
        }
        BaseResponse.success(res, result, 200);
    }
};