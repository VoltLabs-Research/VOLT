import { injectable, inject } from 'tsyringe';
import { GetRBACConfigUseCase } from '@/src/modules/system/application/use-cases/GetRBACConfigUseCase';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';

@injectable()
export default class GetRBACConfigController extends BaseController<GetRBACConfigUseCase>{
    constructor(
        @inject(GetRBACConfigUseCase)
        protected useCase: GetRBACConfigUseCase
    ){
        super(useCase);
    }
};
