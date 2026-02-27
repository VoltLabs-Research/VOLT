import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import DeleteSecretKeyByIdUseCase from '@modules/team/application/use-cases/secret-key/DeleteSecretKeyByIdUseCase';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';

@injectable()
export default class DeleteSecretKeyByIdController extends BaseController<DeleteSecretKeyByIdUseCase> {
    constructor(
        @inject(DeleteSecretKeyByIdUseCase)
        useCase: DeleteSecretKeyByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
}
