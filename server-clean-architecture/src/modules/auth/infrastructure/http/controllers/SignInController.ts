import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import { SignInInputDTO } from '../../../application/dtos/SignInDTO';
import SignInUseCase from '../../../application/use-cases/SignInUseCase';
import getUserAgent from '@/src/shared/infrastructure/http/utilities/get-user-agent';
import getClientIP from '@/src/shared/infrastructure/http/utilities/get-client-ip';

@injectable()
export default class SignInController extends BaseController<SignInUseCase> {
    constructor(
        @inject(SignInUseCase) useCase: SignInUseCase
    ) {
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): SignInInputDTO {
        const { email, password } = req.body;
        const userAgent = getUserAgent(req);
        const ip = getClientIP(req);
        return { email, password, userAgent, ip };
    }
};