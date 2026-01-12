import { injectable } from 'tsyringe';
import CheckEmailUseCase from '../../../application/use-cases/CheckEmailUseCase';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';

@injectable()
export default class CheckEmailController extends BaseController<CheckEmailUseCase>{
    constructor(
        useCase: CheckEmailUseCase
    ){
        super(useCase);
    }
};