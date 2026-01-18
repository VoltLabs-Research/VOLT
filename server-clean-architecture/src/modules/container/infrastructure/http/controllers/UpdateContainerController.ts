import { injectable, inject } from 'tsyringe';
import { UpdateContainerUseCase } from '../../../application/use-cases/UpdateContainerUseCase';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';

@injectable()
export default class UpdateContainerController extends BaseController<UpdateContainerUseCase>{
    constructor(
        @inject(UpdateContainerUseCase)
        protected useCase: UpdateContainerUseCase
    ){
        super(useCase);
    }
};