import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import UpdateAccountUseCase from '../../../application/use-cases/UpdateAccountUseCase';

@injectable()
export default class UpdateMyAccountController{
    constructor(
        private updateAccountUseCase: UpdateAccountUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { firstName, lastName } = req.body;
        const result = await this.updateAccountUseCase.execute({
            id: req.userId!,
            firstName,
            lastName,
            avatar: req.file
        });

        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value);
    }
};