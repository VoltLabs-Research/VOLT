import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { ExecutePluginUseCase } from '../../../../application/use-cases/plugin/ExecutePluginUseCase';

@injectable()
export default class ExecutePluginController extends BaseController<ExecutePluginUseCase> {
    constructor(
        @inject(ExecutePluginUseCase) useCase: ExecutePluginUseCase
    ) {
        super(useCase);
    }
}
