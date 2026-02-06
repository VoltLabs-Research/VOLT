import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { DeleteSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/DeleteSSHConnectionByIdUseCase';

@injectable()
export default class DeleteSSHConnectionByIdController extends BaseController<DeleteSSHConnectionByIdUseCase> {
    constructor(
        @inject(delay(() => DeleteSSHConnectionByIdUseCase))
        useCase: DeleteSSHConnectionByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};