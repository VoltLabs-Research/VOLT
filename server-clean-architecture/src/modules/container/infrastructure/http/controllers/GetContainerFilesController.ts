import { injectable, inject } from 'tsyringe';
import { GetContainerFilesUseCase } from '@modules/container/application/use-cases/GetContainerFilesUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class GetContainerFilesController extends BaseController<GetContainerFilesUseCase>{
    constructor(
        @inject(GetContainerFilesUseCase)
        protected useCase: GetContainerFilesUseCase
    ){
        super(useCase);
    }
};
