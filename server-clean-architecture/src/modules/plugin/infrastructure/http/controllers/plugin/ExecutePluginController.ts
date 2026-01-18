import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { ExecutePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExecutePluginUseCase';

@injectable()
export default class ExecutePluginController extends BaseController<ExecutePluginUseCase> {
    constructor(
        @inject(ExecutePluginUseCase) useCase: ExecutePluginUseCase
    ) {
        super(useCase);
    }
}
