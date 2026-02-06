import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetPluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/GetPluginByIdUseCase';

@injectable()
export default class GetPluginByIdController extends BaseController<GetPluginByIdUseCase> {
    constructor(
        @inject(GetPluginByIdUseCase) useCase: GetPluginByIdUseCase
    ) {
        super(useCase);
    }
}
