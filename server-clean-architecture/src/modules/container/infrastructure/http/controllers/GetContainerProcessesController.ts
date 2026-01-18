import { injectable, inject } from 'tsyringe';
import { GetContainerProcessesUseCase } from '@modules/container/application/use-cases/GetContainerProcessesUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class GetContainerProcessesController extends BaseController<GetContainerProcessesUseCase>{
    constructor(
        @inject(GetContainerProcessesUseCase)
        protected useCase: GetContainerProcessesUseCase
    ){
        super(useCase);
    }
};  
