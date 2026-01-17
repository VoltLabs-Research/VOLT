import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { GetNodeSchemasUseCase } from '../../../../application/use-cases/plugin/GetNodeSchemasUseCase';

@injectable()
export default class GetNodeSchemasController extends BaseController<GetNodeSchemasUseCase> {
    constructor(
        @inject(GetNodeSchemasUseCase) useCase: GetNodeSchemasUseCase
    ) {
        super(useCase);
    }
}
