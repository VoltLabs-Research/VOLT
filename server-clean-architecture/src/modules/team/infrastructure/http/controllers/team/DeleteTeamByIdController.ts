import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import DeleteTeamByIdUseCase from '@/src/modules/team/application/use-cases/team/DeleteTeamByIdUseCase';

@injectable()
export default class DeleteTeamByIdController{
    constructor(
        private useCase: DeleteTeamByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response){
        const { teamId } = req.params;
        const result = await this.useCase.execute({ teamId });
        if(!result.success){
            return BaseResponse.error(res, result.error.message, result.error.statusCode);
        }
        BaseResponse.success(res, result.value, 200);
    }
};