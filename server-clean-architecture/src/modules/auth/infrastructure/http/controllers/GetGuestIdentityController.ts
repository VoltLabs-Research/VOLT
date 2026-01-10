import { Request, Response } from 'express';
import { injectable } from 'tsyringe';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import GetGuestIdentityUseCase from '../../../application/use-cases/GetGuestIdentityUseCase';

@injectable()
export default class GetGuestIdentityController{
    constructor(
        private getGuestIdentityUseCase: GetGuestIdentityUseCase
    ){}

    async handle(req: Request, res: Response): Promise<void>{
        const seed = req.query.seed as string;
        const result = await this.getGuestIdentityUseCase.execute({ seed });

        if(!result.success){
            BaseResponse.error(res, result.error.message, result.error.statusCode);
            return;
        }

        BaseResponse.success(res, result.value);
    }
};