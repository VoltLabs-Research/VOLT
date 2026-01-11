import { Response } from "express";
import { injectable } from "tsyringe";
import BaseResponse from "@/src/shared/infrastructure/http/BaseResponse";
import { AuthenticatedRequest } from "@/src/shared/infrastructure/http/middleware/authentication";
import GetAnalysisByIdUseCase from "../../../application/use-cases/GetAnalysisByIdUseCase";
import GetAnalysesByTeamIdUseCase from "../../../application/use-cases/GetAnalysesByTeamIdUseCase";

@injectable()
export default class GetAnalysesByTeamIdController{
    constructor(
        private useCase: GetAnalysesByTeamIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamId } = req.params;
        const result = await this.useCase.execute({ teamId });
        if(!result.success){
            return BaseResponse.error(res, result.error.message, result.error.statusCode);
        }
        BaseResponse.success(res, null, 204);
    }
};