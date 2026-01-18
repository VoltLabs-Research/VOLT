import { injectable, inject } from 'tsyringe';
import UpdatePasswordUseCase from '@modules/auth/application/use-cases/UpdatePasswordUseCase';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { UpdatePasswordInputDTO } from '@modules/auth/application/dtos/UpdatePasswordDTO';
import getUserAgent from '@shared/infrastructure/http/utilities/get-user-agent';
import getClientIP from '@shared/infrastructure/http/utilities/get-client-ip';

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