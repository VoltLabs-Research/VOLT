import { injectable, inject } from 'tsyringe';
import { ReadContainerFileUseCase } from '@modules/container/application/use-cases/ReadContainerFileUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class ReadContainerFileController extends BaseController<ReadContainerFileUseCase> {
    constructor(
        @inject(ReadContainerFileUseCase)
        protected useCase: ReadContainerFileUseCase
    ) {
        super(useCase);
    }
};
