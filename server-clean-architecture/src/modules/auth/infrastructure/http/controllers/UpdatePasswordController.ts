import { injectable, inject } from 'tsyringe';
import UpdatePasswordUseCase from '../../../application/use-cases/UpdatePasswordUseCase';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { UpdatePasswordInputDTO } from '../../../application/dtos/UpdatePasswordDTO';
import getUserAgent from '@/src/shared/infrastructure/http/utilities/get-user-agent';
import getClientIP from '@/src/shared/infrastructure/http/utilities/get-client-ip';

@injectable()
export default class UpdatePasswordController extends BaseController<UpdatePasswordUseCase> {
    constructor(
        @inject(UpdatePasswordUseCase) useCase: UpdatePasswordUseCase
    ) {
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): UpdatePasswordInputDTO {
        const { passwordCurrent, password } = req.body;
        const userAgent = getUserAgent(req);
        const ip = getClientIP(req);
        const userId = req.userId!;
        return { userId, password, passwordCurrent, userAgent, ip };
    }
};