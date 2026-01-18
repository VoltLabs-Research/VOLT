import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetNodeSchemasOutputDTO } from '@modules/plugin/application/dtos/plugin/GetNodeSchemasDTO';

export interface INodeRegistryService {
    getAllSchemas(): Record<string, any>;
}

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class GetNodeSchemasUseCase implements IUseCase<void, GetNodeSchemasOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.NodeRegistry) private nodeRegistry: INodeRegistryService
    ) { }

    async execute(): Promise<Result<GetNodeSchemasOutputDTO>> {
        const schemas = this.nodeRegistry.getAllSchemas();
        return Result.ok({ schemas });
    }
}
