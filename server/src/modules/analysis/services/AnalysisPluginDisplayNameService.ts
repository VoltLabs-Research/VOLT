import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { inject, injectable } from 'tsyringe';
import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';

const getNodesFromWorkflow = (workflowValue: unknown): unknown[] => {
    if (!isRecord(workflowValue)) {
        return [];
    }

    const workflowProps = workflowValue.props;
    if (!isRecord(workflowProps)) {
        return [];
    }

    if (!Array.isArray(workflowProps.nodes)) {
        return [];
    }

    return workflowProps.nodes;
};

const getPluginNodes = (pluginValue: unknown): unknown[] => {
    if (!isRecord(pluginValue)) {
        return [];
    }

    let nodes = getNodesFromWorkflow(pluginValue.workflow);
    if (nodes.length > 0) {
        return nodes;
    }

    const pluginProps = pluginValue.props;
    if (!isRecord(pluginProps)) {
        return [];
    }

    nodes = getNodesFromWorkflow(pluginProps.workflow);
    return nodes;
};

const getModifierName = (nodeValue: unknown): string => {
    if (!isRecord(nodeValue)) {
        return '';
    }

    const nodeData = nodeValue.data;
    if (!isRecord(nodeData)) {
        return '';
    }

    const modifierValue = nodeData.modifier;
    if (!isRecord(modifierValue)) {
        return '';
    }

    if (typeof modifierValue.name !== 'string') {
        return '';
    }

    return modifierValue.name.trim();
};

export const extractPluginId = (pluginValue: unknown): string => {
    let pluginId = '';

    if (typeof pluginValue === 'string') {
        pluginId = pluginValue;
    } else if (isRecord(pluginValue) && pluginValue._id != null) {
        pluginId = String(pluginValue._id);
    }

    return pluginId;
};

@injectable()
export default class AnalysisPluginDisplayNameService {
    private readonly pluginNameCache = new Map<string, string>();

    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ) {}

    async resolveModifierName(pluginValue: unknown): Promise<string> {
        if (typeof pluginValue !== 'string') {
            const directNodes = getPluginNodes(pluginValue);
            const directModifier = directNodes.find(
                (node) => isRecord(node) && node.type === WorkflowNodeType.Modifier
            );
            const directName = getModifierName(directModifier);

            if (directName) {
                return directName;
            }
        }

        const pluginId = extractPluginId(pluginValue);

        if (!pluginId) {
            return '';
        }

        if (this.pluginNameCache.has(pluginId)) {
            return this.pluginNameCache.get(pluginId)!;
        }

        const pluginById = await this.pluginRepository.findById(pluginId);
        const nodes = getPluginNodes(pluginById);
        let modifierNode: unknown;

        if (Array.isArray(nodes)) {
            modifierNode = nodes.find(
                (node) => isRecord(node) && node.type === WorkflowNodeType.Modifier
            );
        }

        const modifierName = getModifierName(modifierNode);

        this.pluginNameCache.set(pluginId, modifierName);
        return modifierName;
    }
}
