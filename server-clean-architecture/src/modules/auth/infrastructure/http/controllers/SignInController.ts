import { Request, Response } from 'express';
import { injectable } from 'tsyringe';
import SignInUseCase from '../../../application/use-cases/SignInUseCase';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';

@injectable()
export default class SignInController{
    constructor(
        private signInUseCase: SignInUseCase
    ){}

    async handle(req: Request, res: Response): Promise<void>{
        const { email, password } = req.body;
        const userAgent = req.headers['user-agent'] || 'unknown';
        const ip = req.ip || 'unknown';

        const result = await this.signInUseCase.execute({
            email,
            password,
            userAgent,
            ip
        });

        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value);
    }
};