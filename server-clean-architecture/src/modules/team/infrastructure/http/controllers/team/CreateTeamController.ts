import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import CreateTeamUseCase from '@/src/modules/team/application/use-cases/team/CreateTeamUseCase';

@injectable()
export default class CreateTeamController{
    constructor(
        private useCase: CreateTeamUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { name, description } = req.body;
        const result = await this.useCase.execute({
            name,
            description,
            ownerId: req.userId!
        });

        if(!result.success){
            return BaseResponse.error(res, result.error.message, result.error.statusCode);
        }

        BaseResponse.success(res, result.value, 201);
    }
};