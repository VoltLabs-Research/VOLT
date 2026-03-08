import { injectable, inject } from 'tsyringe';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

interface PluginLike {
    _id?: string;
    props?: {
        workflow?: {
            props?: {
                nodes?: PluginNodeLike[];
            };
        };
    };
    workflow?: {
        props?: {
            nodes?: PluginNodeLike[];
        };
    };
}

interface PluginNodeLike {
    type?: string;
    data?: {
        modifier?: {
            name?: string;
        };
    };
}

@injectable()
export default class AnalysisPluginDisplayNameService {
    private readonly pluginNameCache = new Map<string, string>();

    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ) {}

    async resolveModifierName(pluginValue: PluginLike | string): Promise<string> {
        if (typeof pluginValue !== 'string') {
            const directNodes = pluginValue?.props?.workflow?.props?.nodes
                || pluginValue?.workflow?.props?.nodes
                || [];

            if (Array.isArray(directNodes)) {
                const directModifier = directNodes.find(
                    (node) => node?.type === WorkflowNodeType.Modifier
                );
                const directName = typeof directModifier?.data?.modifier?.name === 'string'
                    ? directModifier.data.modifier.name.trim()
                    : '';
                if (directName) return directName;
            }
        }

        const pluginId = typeof pluginValue === 'string'
            ? pluginValue
            : String(pluginValue?._id || '');

        if (!pluginId) return '';
        if (this.pluginNameCache.has(pluginId)) return this.pluginNameCache.get(pluginId)!;

        const pluginById = await this.pluginRepository.findById(pluginId);
        const nodes = pluginById?.props?.workflow?.props?.nodes || [];
        const modifierNode = Array.isArray(nodes)
            ? nodes.find((node: PluginNodeLike) => node?.type === WorkflowNodeType.Modifier)
            : undefined;
        const modifierName = typeof modifierNode?.data?.modifier?.name === 'string'
            ? modifierNode.data.modifier.name.trim()
            : '';

        this.pluginNameCache.set(pluginId, modifierName);
        return modifierName;
    }
}
