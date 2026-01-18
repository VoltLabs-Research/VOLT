import { injectable, inject } from 'tsyringe';
import { GetRBACConfigUseCase } from '@modules/system/application/use-cases/GetRBACConfigUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class GetRBACConfigController extends BaseController<GetRBACConfigUseCase>{
    constructor(
        @inject(GetRBACConfigUseCase)
        protected useCase: GetRBACConfigUseCase
    ){
        super(useCase);
    }
};
