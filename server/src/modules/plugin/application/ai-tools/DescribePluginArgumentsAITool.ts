import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { DescribePluginArgumentsUseCase } from '@modules/plugin/application/use-cases/plugin/DescribePluginArgumentsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DescribePluginArgumentsAITool extends AITool {
    readonly name = 'describe_plugin_arguments';
    readonly description = 'Describe the configurable arguments a plugin accepts (key, type, default, range, options) so you can build a valid config before running it.';
    readonly parameters = z.object({
        pluginId: z.string()
    });

    constructor(
        protected readonly useCase: DescribePluginArgumentsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>) {
        const result = await this.useCase.execute({ pluginId: params.pluginId });

        const value = result;
        return {
            summary: `Plugin "${value.name}" accepts ${value.arguments.length} argument(s).`,
            data: value
        };
    }
}
