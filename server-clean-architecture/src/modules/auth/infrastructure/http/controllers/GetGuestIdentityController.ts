import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetGuestIdentityUseCase from '../../../application/use-cases/GetGuestIdentityUseCase';

@injectable()
export default class GetGuestIdentityController extends BaseController<GetGuestIdentityUseCase> {
    constructor(
        @inject(GetGuestIdentityUseCase) useCase: GetGuestIdentityUseCase
    ) {
        super(useCase);
    }
};