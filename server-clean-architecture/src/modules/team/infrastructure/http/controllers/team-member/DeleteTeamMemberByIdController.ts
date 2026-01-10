import { Response } from "express";
import { injectable } from "tsyringe";
import BaseResponse from "@/src/shared/infrastructure/http/BaseResponse";
import { AuthenticatedRequest } from "@/src/shared/infrastructure/http/middleware/authentication";
import CreateTeamMemberUseCase from "@/src/modules/team/application/use-cases/team-member/CreateTeamMemberUseCase";
import DeleteTeamMemberByIdUseCase from "@/src/modules/team/application/use-cases/team-member/DeleteTeamMemberByIdUseCase";

@injectable()
export default class DeleteTeamMemberByIdController{
    constructor(
        private useCase: DeleteTeamMemberByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamMemberId } = req.params;
        const result = await this.useCase.execute({ teamMemberId });
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }
        BaseResponse.success(res, result.value, 200);
    }
};