import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { CreatePluginUseCase } from '../../../../application/use-cases/plugin/CreatePluginUseCase';

@injectable()
export default class CreatePluginController extends BaseController<CreatePluginUseCase> {
    constructor(
        @inject(CreatePluginUseCase) useCase: CreatePluginUseCase
    ) {
        super(useCase);
    }
}
