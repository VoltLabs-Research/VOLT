import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import UpdateAccountUseCase from '../../../application/use-cases/UpdateAccountUseCase';

@injectable()
export default class UpdateMyAccountController extends BaseController<UpdateAccountUseCase>{
    constructor(
        useCase: UpdateAccountUseCase
    ){
        super(useCase);
    }
};