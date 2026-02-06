import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { SignUpInputDTO } from '@modules/auth/application/dtos/SignUpDTO';
import SignUpUseCase from '@modules/auth/application/use-cases/SignUpUseCase';
import getUserAgent from '@shared/infrastructure/http/utilities/get-user-agent';
import getClientIP from '@shared/infrastructure/http/utilities/get-client-ip';

@injectable()
export default class SignUpController extends BaseController<SignUpUseCase> {
    constructor(
        @inject(SignUpUseCase) useCase: SignUpUseCase
    ) {
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): SignUpInputDTO {
        const { email, password, firstName, lastName } = req.body;
        const userAgent = getUserAgent(req);
        const ip = getClientIP(req);
        return { email, password, firstName, lastName, userAgent, ip };
    }
};