import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { ListPluginsUseCase } from '../../../../application/use-cases/plugin/ListPluginsUseCase';

@injectable()
export default class ListPluginsController extends BaseController<ListPluginsUseCase> {
    constructor(
        @inject(ListPluginsUseCase) useCase: ListPluginsUseCase
    ) {
        super(useCase);
    }
}
