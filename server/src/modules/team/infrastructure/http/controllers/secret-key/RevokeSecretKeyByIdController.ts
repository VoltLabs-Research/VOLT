import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import RevokeSecretKeyByIdUseCase from '@modules/team/application/use-cases/secret-key/RevokeSecretKeyByIdUseCase';

@injectable()
export default class RevokeSecretKeyByIdController extends BaseController<RevokeSecretKeyByIdUseCase> {
    constructor(
        @inject(RevokeSecretKeyByIdUseCase)
        useCase: RevokeSecretKeyByIdUseCase
    ) {
        super(useCase);
    }
}
