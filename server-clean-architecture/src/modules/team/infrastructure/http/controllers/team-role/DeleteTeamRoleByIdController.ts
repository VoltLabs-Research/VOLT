import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import DeleteTeamRoleByIdUseCase from '@/src/modules/team/application/use-cases/team-role/DeleteTeamRoleByIdUseCase';

@injectable()
export default class DeleteTeamRoleByIdController{
    constructor(
        private useCase: DeleteTeamRoleByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { roleId } = req.params;
        const result = await this.useCase.execute({ roleId });
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, null, 200);
    }
};