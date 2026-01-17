import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { GetNodeSchemasOutputDTO } from '../../dtos/plugin/GetNodeSchemasDTO';

export interface INodeRegistryService {
    getAllSchemas(): Record<string, any>;
}

@injectable()
export class GetNodeSchemasUseCase implements IUseCase<void, GetNodeSchemasOutputDTO> {
    constructor(
        @inject('INodeRegistryService') private nodeRegistry: INodeRegistryService
    ) { }

    async execute(): Promise<Result<GetNodeSchemasOutputDTO>> {
        const schemas = this.nodeRegistry.getAllSchemas();
        return Result.ok({ schemas });
    }
}
