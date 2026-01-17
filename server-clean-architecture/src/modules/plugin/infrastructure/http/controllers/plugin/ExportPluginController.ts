import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { ExportPluginUseCase } from '../../../../application/use-cases/plugin/ExportPluginUseCase';

@injectable()
export default class ExportPluginController extends BaseController<ExportPluginUseCase> {
    constructor(
        @inject(ExportPluginUseCase) useCase: ExportPluginUseCase
    ) {
        super(useCase);
    }
}
