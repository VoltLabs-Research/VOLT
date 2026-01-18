import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetNodeSchemasUseCase } from '@modules/plugin/application/use-cases/plugin/GetNodeSchemasUseCase';

@injectable()
export default class GetNodeSchemasController extends BaseController<GetNodeSchemasUseCase> {
    constructor(
        @inject(GetNodeSchemasUseCase) useCase: GetNodeSchemasUseCase
    ) {
        super(useCase);
    }
}
