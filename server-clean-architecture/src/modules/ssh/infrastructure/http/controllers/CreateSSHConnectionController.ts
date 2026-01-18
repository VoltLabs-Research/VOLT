import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { CreateSSHConnectionUseCase } from '@modules/ssh/application/use-cases/CreateSSHConnectionUseCase';

@injectable()
export default class CreateSSHConnectionController extends BaseController<CreateSSHConnectionUseCase> {
    constructor(
        @inject(delay(() => CreateSSHConnectionUseCase))
        useCase: CreateSSHConnectionUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
};