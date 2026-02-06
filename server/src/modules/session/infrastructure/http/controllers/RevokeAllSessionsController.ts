import { injectable, inject } from 'tsyringe';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { RevokeAllSessionsInputDTO } from '@modules/session/application/dtos/RevokeAllSessionsDTo';
import RevokeAllSessionsUseCase from '@modules/session/application/use-cases/RevokeAllSessionsUseCase';

@injectable()
export default class RevokeAllSessionsController extends BaseController<RevokeAllSessionsUseCase> {
    constructor(
        @inject(RevokeAllSessionsUseCase) useCase: RevokeAllSessionsUseCase
    ) {
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): RevokeAllSessionsInputDTO {
        return {
            token: req.token!,
            userId: req.userId!
        };
    }
};