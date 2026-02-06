import { injectable, inject } from 'tsyringe';
import { CreateContainerUseCase } from '@modules/container/application/use-cases/CreateContainerUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class CreateContainerController extends BaseController<CreateContainerUseCase>{
    constructor(
        @inject(CreateContainerUseCase)
        protected useCase: CreateContainerUseCase
    ){
        super(useCase);
    }
};
