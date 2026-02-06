import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { ExportPluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExportPluginUseCase';

@injectable()
export default class ExportPluginController extends BaseController<ExportPluginUseCase> {
    constructor(
        @inject(ExportPluginUseCase) useCase: ExportPluginUseCase
    ) {
        super(useCase);
    }
}
