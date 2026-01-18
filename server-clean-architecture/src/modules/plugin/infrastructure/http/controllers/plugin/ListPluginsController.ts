import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { ListPluginsUseCase } from '@modules/plugin/application/use-cases/plugin/ListPluginsUseCase';

@injectable()
export default class ListPluginsController extends BaseController<ListPluginsUseCase> {
    constructor(
        @inject(ListPluginsUseCase) useCase: ListPluginsUseCase
    ) {
        super(useCase);
    }
}
