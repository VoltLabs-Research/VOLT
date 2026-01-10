import { Response } from 'express';
import { inject, injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import UpdatePasswordUseCase from '../../../application/use-cases/UpdatePasswordUseCase';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';

@injectable()
export default class UpdatePasswordController{
    constructor(
        private updatePasswordUseCase: UpdatePasswordUseCase
    ){}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void>{
        const { passwordCurrent, password } = req.body;
        const userAgent = req.headers['user-agent'] || 'unknown';
        const ip = req.ip || 'unknown';

        const result = await this.updatePasswordUseCase.execute({
            user: req.user,
            passwordCurrent,
            password,
            userAgent,
            ip
        });

        if(!result.success){
            BaseResponse.error(res, result.error.message ,result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value);
    }
};