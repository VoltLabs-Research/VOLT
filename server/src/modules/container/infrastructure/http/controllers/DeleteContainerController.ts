import { injectable, inject } from 'tsyringe';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class DeleteContainerController extends BaseController<DeleteContainerUseCase>{
    constructor(
        @inject(DeleteContainerUseCase)
        protected useCase: DeleteContainerUseCase
    ){
        super(useCase);
    }
};