import { Request, Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import CheckEmailUseCase from '../../../application/use-cases/CheckEmailUseCase';

@injectable()
export default class CheckEmailController{
    constructor(
        private checkEmailUseCase: CheckEmailUseCase
    ){}

    async handle(req: Request, res: Response): Promise<void>{
        const result = await this.checkEmailUseCase.execute({ email: req.body.email });

        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value);
    }
};