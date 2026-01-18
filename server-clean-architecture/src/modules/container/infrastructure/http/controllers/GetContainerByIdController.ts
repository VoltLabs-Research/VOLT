import { injectable, inject } from 'tsyringe';
import { GetContainerByIdUseCase } from '../../../application/use-cases/GetContainerByIdUseCase';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';

@injectable()
export default class GetContainerByIdController extends BaseController<GetContainerByIdUseCase> {
    constructor(
        @inject(GetContainerByIdUseCase)
        protected useCase: GetContainerByIdUseCase
    ){
        super(useCase);
    }
};
