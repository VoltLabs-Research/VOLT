import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import RemoveUserFromTeamUseCase from '@/src/modules/team/application/use-cases/team/RemoveUserFromTeamUseCase';

@injectable()
export default class RemoveUserFromTeamController{
    constructor(
        private useCase: RemoveUserFromTeamUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamId } = req.params;
        const { toRemoveUserId } = req.body;
        const result = await this.useCase.execute({ teamId, toRemoveUserId });        
        if(!result.success){
            return BaseResponse.error(res, result.error.message, result.error.statusCode);
        }
        
        BaseResponse.success(res, null, 200);
    }
};