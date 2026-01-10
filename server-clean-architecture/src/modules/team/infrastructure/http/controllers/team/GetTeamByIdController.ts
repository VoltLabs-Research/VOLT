import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import GetTeamByIdUseCase from '@/src/modules/team/application/use-cases/team/GetTeamByIdUseCase';

@injectable()
export default class GetTeamByIdController{
    constructor(
        private useCase: GetTeamByIdUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { teamId } = req.params;
        const result = await this.useCase.execute({ teamId });
        if(!result.success){
            return BaseResponse.error(res, result.error.message, result.error.statusCode);
        }

        BaseResponse.success(res, result.value, 200);
    }
};