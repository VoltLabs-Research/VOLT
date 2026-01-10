import { Response } from "express";
import { injectable } from "tsyringe";
import BaseResponse from "@/src/shared/infrastructure/http/BaseResponse";
import { AuthenticatedRequest } from "@/src/shared/infrastructure/http/middleware/authentication";
import ListTeamMembersByTeamIdUseCase from "@/src/modules/team/application/use-cases/team-member/ListTeamMembersByTeamIdUseCase";

@injectable()
export default class ListTeamMembersByTeamIdController{
    constructor(
        private useCase: ListTeamMembersByTeamIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamId } = req.params;
        const results = await this.useCase.execute({ teamId, limit: 100, page: 1 });
        if(!results.success){
            BaseResponse.error(res, results.error.message, results.error.statusCode);
            return;
        }
        BaseResponse.success(res, results.value, 200);
    }
};