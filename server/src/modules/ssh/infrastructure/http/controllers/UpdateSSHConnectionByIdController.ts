import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { UpdateSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/UpdateSSHConnectionByIdUseCase';

@injectable()
export default class UpdateSSHConnectionByIdController extends BaseController<UpdateSSHConnectionByIdUseCase> {
    constructor(
        @inject(delay(() => UpdateSSHConnectionByIdUseCase))
        useCase: UpdateSSHConnectionByIdUseCase
    ) {
        super(useCase);
    }
};