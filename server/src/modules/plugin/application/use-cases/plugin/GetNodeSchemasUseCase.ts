import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { GetNodeSchemasOutputDTO } from '@modules/plugin/application/dtos/plugin/GetNodeSchemasDTO';
import { INodeRegistry } from '@modules/plugin/domain/port/INodeRegistry';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';

@injectable()
export class GetNodeSchemasUseCase implements IUseCase<void, GetNodeSchemasOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.NodeRegistry)
        private readonly nodeRegistry: INodeRegistry
    ){}

    async execute(): Promise<Result<GetNodeSchemasOutputDTO>> {
        return Result.ok({
            schemas: this.nodeRegistry.getSchemas()
        });
    }
}
