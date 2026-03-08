import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { GetNodeSchemasOutputDTO } from '@modules/plugin/application/dtos/plugin/GetNodeSchemasDTO';
import { INodeRegistry } from '@modules/plugin/domain/port/plugin/INodeRegistry';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

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
};
