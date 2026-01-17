import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { ImportPluginUseCase } from '../../../../application/use-cases/plugin/ImportPluginUseCase';

@injectable()
export default class ImportPluginController extends BaseController<ImportPluginUseCase> {
    constructor(
        @inject(ImportPluginUseCase) useCase: ImportPluginUseCase
    ) {
        super(useCase);
    }

};