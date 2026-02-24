import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import CreateSecretKeyUseCase from '@modules/team/application/use-cases/secret-key/CreateSecretKeyUseCase';

@injectable()
export default class CreateSecretKeyController extends BaseController<CreateSecretKeyUseCase> {
    constructor(
        @inject(CreateSecretKeyUseCase)
        useCase: CreateSecretKeyUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
}
