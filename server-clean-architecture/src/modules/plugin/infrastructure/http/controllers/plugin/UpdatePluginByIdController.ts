import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { UpdatePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/UpdatePluginByIdUseCase';

@injectable()
export default class UpdatePluginByIdController extends BaseController<UpdatePluginByIdUseCase> {
    constructor(
        @inject(UpdatePluginByIdUseCase) useCase: UpdatePluginByIdUseCase
    ) {
        super(useCase);
    }
}
