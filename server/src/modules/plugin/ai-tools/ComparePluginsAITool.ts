import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { GetPluginByIdUseCase } from '@modules/plugin/use-cases/plugin/GetPluginByIdUseCase';
import type { PersistedPluginDTO } from '@modules/plugin/dtos/plugin/PersistedPluginDTO';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

interface PluginTopology {
    name: string;
    status: string;
    argumentKeys: string[];
    exposureNames: string[];
    nodeCount: number;
    edgeCount: number;
    nodeTypeCounts: Record<string, number>;
}

const summarize = (plugin: PersistedPluginDTO): PluginTopology => {
    const nodes = plugin.workflow?.nodes ?? [];
    const edges = plugin.workflow?.edges ?? [];
    const nodeTypeCounts: Record<string, number> = {};
    for (const node of nodes) {
        const type = String(node.type ?? 'unknown');
        nodeTypeCounts[type] = (nodeTypeCounts[type] ?? 0) + 1;
    }
    return {
        name: plugin.modifier?.name ?? plugin._id,
        status: plugin.status,
        argumentKeys: (plugin.arguments ?? []).map((arg) => arg.argument).filter(Boolean),
        exposureNames: (plugin.exposures ?? []).map((exposure) => exposure.name).filter(Boolean),
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodeTypeCounts
    };
};

const diffSets = (a: string[], b: string[]) => ({
    onlyInA: a.filter((item) => !b.includes(item)),
    onlyInB: b.filter((item) => !a.includes(item)),
    shared: a.filter((item) => b.includes(item))
});

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ComparePluginsAITool extends AITool {
    readonly name = 'compare_plugins';
    readonly description = 'Compare two plugins side by side: their arguments, exposures, and workflow topology (node/edge counts and node-type composition). Useful for explaining how two analysis plugins differ.';
    readonly parameters = z.object({
        pluginIdA: z.string(),
        pluginIdB: z.string()
    });

    constructor(
        protected readonly useCase: GetPluginByIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const [resultA, resultB] = await Promise.all([
            this.useCase.execute({ pluginId: params.pluginIdA }),
            this.useCase.execute({ pluginId: params.pluginIdB })
        ]);

        const a = summarize(resultA);
        const b = summarize(resultB);

        const data = {
            a,
            b,
            argumentsDiff: diffSets(a.argumentKeys, b.argumentKeys),
            exposuresDiff: diffSets(a.exposureNames, b.exposureNames),
            topology: {
                nodeCountDelta: b.nodeCount - a.nodeCount,
                edgeCountDelta: b.edgeCount - a.edgeCount
            }
        };

        return {
            summary: `Compared "${a.name}" and "${b.name}": ${data.argumentsDiff.shared.length} shared arguments, ${data.exposuresDiff.shared.length} shared exposures; node counts ${a.nodeCount} vs ${b.nodeCount}.`,
            data
        };
    }
}
