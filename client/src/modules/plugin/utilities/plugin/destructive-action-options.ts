import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-registry';
import { ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import type { ConfirmActionOptions } from '@/shared/presentation/hooks/use-confirm';
import type { Node } from '@xyflow/react';

interface NodeDisplayData {
    label?: string;
};

const getNodeDisplayData = (node: Node): NodeDisplayData | null => {
    const { data } = node;

    if (typeof data !== 'object' || data === null || !('label' in data)) {
        return null;
    }

    const { label } = data;
    if (typeof label !== 'string') {
        return null;
    }

    return { label };
};

export const getPluginNodeLabel = (node: Node): string => {
    const nodeData = getNodeDisplayData(node);
    const trimmedLabel = nodeData?.label?.trim();

    if (trimmedLabel) {
        return trimmedLabel;
    }

    if (typeof node.type === 'string' && node.type.trim()) {
        const nodeType = Object.values(NodeType).find((value) => value === node.type);
        if (nodeType) {
            return NODE_CONFIGS[nodeType].label;
        }

        return node.type;
    }

    return 'node';
};

export const buildDeleteNodeConfirmOptions = (node: Node): ConfirmActionOptions => {
    const nodeLabel = getPluginNodeLabel(node);

    return {
        title: 'Delete node?',
        description: `Remove ${nodeLabel} and its connections. This action cannot be undone.`,
        confirmText: 'Delete node',
        cancelText: 'Keep node',
        tone: ConfirmActionTone.Danger
    };
};

export const buildDeleteConditionConfirmOptions = (conditionIndex: number): ConfirmActionOptions => {
    return {
        title: 'Delete condition?',
        description: `Remove condition ${conditionIndex + 1} from this branch check. This action cannot be undone.`,
        confirmText: 'Delete condition',
        cancelText: 'Keep condition',
        tone: ConfirmActionTone.Danger
    };
};
