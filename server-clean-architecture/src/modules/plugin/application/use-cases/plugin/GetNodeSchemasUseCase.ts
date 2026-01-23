import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetNodeSchemasOutputDTO } from '@modules/plugin/application/dtos/plugin/GetNodeSchemasDTO';
import { INodeRegistry } from '@modules/plugin/domain/ports/INodeRegistry';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class GetNodeSchemasUseCase implements IUseCase<void, GetNodeSchemasOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.NodeRegistry)
        private nodeRegistry: INodeRegistry
    ){}

    async execute(): Promise<Result<GetNodeSchemasOutputDTO>> {
        const schemas = this.nodeRegistry.getSchemas();
        return Result.ok({ schemas });
    }
}
