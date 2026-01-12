import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import { SignUpInputDTO } from '../../../application/dtos/SignUpDTO';
import SignUpUseCase from '../../../application/use-cases/SignUpUseCase';
import getUserAgent from '@/src/shared/infrastructure/http/utilities/get-user-agent';
import getClientIP from '@/src/shared/infrastructure/http/utilities/get-client-ip';

@injectable()
export default class SignUpController extends BaseController<SignUpUseCase>{
    constructor(
        useCase: SignUpUseCase
    ){
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): SignUpInputDTO {
        const { email, password, firstName, lastName } = req.body;
        const userAgent = getUserAgent(req);
        const ip = getClientIP(req);
        return { email, password, firstName, lastName, userAgent, ip };
    }
};