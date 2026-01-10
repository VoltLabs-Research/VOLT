import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import CreateTeamRoleUseCase from '@/src/modules/team/application/use-cases/team-role/CreateTeamRoleUseCase';

@injectable()
export default class CreateTeamRoleController{
    constructor(
        private useCase: CreateTeamRoleUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { name, permissions } = req.body;
        const { teamId } = req.params;

        const result = await this.useCase.execute({ name, teamId, permissions });
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value, 201);
    }
};