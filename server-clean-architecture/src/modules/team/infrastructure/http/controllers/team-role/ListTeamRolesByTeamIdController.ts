import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import ListTeamRolesByTeamIdUseCase from '@/src/modules/team/application/use-cases/team-role/ListTeamRolesByTeamIdUseCase';

@injectable()
export default class ListTeamRolesByTeamIdController{
    constructor(
        private useCase: ListTeamRolesByTeamIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamId } = req.params;
        const result = await this.useCase.execute({ limit: 100, page: 1, teamId });

        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value, 200);
    }
};