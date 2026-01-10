import { Request, Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import SignUpUseCase from '../../../application/use-cases/SignUpUseCase';

@injectable()
export default class SignUpController{
    constructor(
        private signUpUseCase: SignUpUseCase
    ){}

    async handle(req: Request, res: Response): Promise<void>{
        const { email, password, firstName, lastName } = req.body;

        const userAgent = req.headers['user-agent'] || 'unknown';
        const ip = req.ip || 'unknown';

        const result = await this.signUpUseCase.execute({
            email,
            password,
            firstName,
            lastName,
            userAgent,
            ip
        });

        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value, 201);
    }
};