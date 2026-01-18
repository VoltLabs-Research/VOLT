import { injectable, inject } from 'tsyringe';
import { ListContainersUseCase } from '@modules/container/application/use-cases/ListContainersUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class ListContainersController extends BaseController<ListContainersUseCase>{
    constructor(
        @inject(ListContainersUseCase)
        protected useCase: ListContainersUseCase
    ){
        super(useCase);
    }
};
