import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import ListSSHFilesUseCase from '@modules/ssh/application/use-cases/ListSSHFilesUseCase';

@injectable()
export default class ListSSHFilesController extends BaseController<ListSSHFilesUseCase>{
    constructor(
        @inject(ListSSHFilesUseCase)
        useCase: ListSSHFilesUseCase
    ){
        super(useCase);
    }
};