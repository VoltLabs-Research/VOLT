import { injectable, inject } from 'tsyringe';
import { DeleteContainerUseCase } from '../../../application/use-cases/DeleteContainerUseCase';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';

@injectable()
export default class DeleteContainerController extends BaseController<DeleteContainerUseCase>{
    constructor(
        @inject(DeleteContainerUseCase)
        protected useCase: DeleteContainerUseCase
    ){
        super(useCase);
    }
};