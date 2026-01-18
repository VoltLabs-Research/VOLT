import { injectable, inject } from 'tsyringe';
import { GetContainerProcessesUseCase } from '../../../application/use-cases/GetContainerProcessesUseCase';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';

@injectable()
export default class GetContainerProcessesController extends BaseController<GetContainerProcessesUseCase>{
    constructor(
        @inject(GetContainerProcessesUseCase)
        protected useCase: GetContainerProcessesUseCase
    ){
        super(useCase);
    }
};  
