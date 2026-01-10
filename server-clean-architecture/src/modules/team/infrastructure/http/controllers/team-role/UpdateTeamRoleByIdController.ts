import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import UpdateTeamRoleByIdUseCase from '@/src/modules/team/application/use-cases/team-role/UpdateTeamRoleByIdUseCase';

@injectable()
export default class UpdateTeamRoleByIdController{
    constructor(
        private useCase: UpdateTeamRoleByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { roleId } = req.params;
        const { name, permissions } = req.body;
        const result = await this.useCase.execute({ roleId, name, permissions });

        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, null, 200);
    }
};