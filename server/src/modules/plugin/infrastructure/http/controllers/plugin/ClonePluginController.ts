import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { ClonePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ClonePluginUseCase';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';

@injectable()
export default class ClonePluginController extends BaseController<ClonePluginUseCase> {
    constructor(
        @inject(ClonePluginUseCase) useCase: ClonePluginUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
}
