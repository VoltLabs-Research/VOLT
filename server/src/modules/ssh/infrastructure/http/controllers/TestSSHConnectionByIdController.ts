import { injectable, inject, delay } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { TestSSHConnectionsByIdUseCase } from '@modules/ssh/application/use-cases/TestSSHConnectionsByIdUseCase';

@injectable()
export default class TestSSHConnectionsByIdController extends BaseController<TestSSHConnectionsByIdUseCase> {
    constructor(
        @inject(delay(() => TestSSHConnectionsByIdUseCase))
        useCase: TestSSHConnectionsByIdUseCase
    ) {
        super(useCase);
    }
};