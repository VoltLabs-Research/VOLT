import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import GetTeamRoleByIdUseCase from '@/src/modules/team/application/use-cases/team-role/GetTeamRoleByIdUseCase';

@injectable()
export default class GetTeamRoleByIdController{
    constructor(
        private useCase: GetTeamRoleByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { roleId } = req.params;
        const result = await this.useCase.execute({ roleId });

        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value, 200);
    }
};