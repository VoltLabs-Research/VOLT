import { injectable, inject } from 'tsyringe';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { RevokeAllSessionsInputDTO } from '../../../application/dtos/RevokeAllSessionsDTo';
import RevokeAllSessionsUseCase from '../../../application/use-cases/RevokeAllSessionsUseCase';

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