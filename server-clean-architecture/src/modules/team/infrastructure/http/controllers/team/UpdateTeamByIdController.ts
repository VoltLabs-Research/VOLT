import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import UpdateTeamByIdUseCase from '@/src/modules/team/application/use-cases/team/UpdateTeamByIdUseCase';

@injectable()
export default class UpdateTeamByIdController{
    constructor(
        private useCase: UpdateTeamByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamId } = req.params;
        const { name, description } = req.body;
        const result = await this.useCase.execute({ teamId, name, description });
        if(!result.success){
            return BaseResponse.error(res, result.error.message, result.error.statusCode);
        }

        BaseResponse.success(res, result.value, 200);
    }
};