import { Response } from "express";
import { injectable } from "tsyringe";
import BaseResponse from "@/src/shared/infrastructure/http/BaseResponse";
import { AuthenticatedRequest } from "@/src/shared/infrastructure/http/middleware/authentication";
import CreateTeamMemberUseCase from "@/src/modules/team/application/use-cases/team-member/CreateTeamMemberUseCase";

@injectable()
export default class CreateTeamMemberController{
    constructor(
        private useCase: CreateTeamMemberUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamId } = req.params;
        const { roleId } = req.body;
        const userId = req.userId!;
        const result = await this.useCase.execute({ roleId, teamId, userId });
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }
        BaseResponse.success(res, result.value, 201);
    }
};