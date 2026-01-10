import { Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import DeleteAccountUseCase from '../../../application/use-cases/DeleteAccountUseCase';

@injectable()
export default class DeleteMyAccountController{
    constructor(
        private deleteAccountUseCase: DeleteAccountUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const result = await this.deleteAccountUseCase.execute({ id: req.userId! });
        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, null, 204);
    }
};