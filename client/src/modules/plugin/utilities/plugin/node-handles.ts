import { Position } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type {
    INodeConnectorLayout,
    INodeConnectorPlacement,
    INodeData,
    NodeConnectorSide
} from '@/modules/plugin/api/entities/plugin/workflow';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { SelectOption } from '@/shared/presentation/components/Select';

export interface NodeHandleDefinition {
    id: string;
    type: 'source' | 'target';
    label: string;
    defaultPlacement: INodeConnectorPlacement;
    className?: string;
}

const DEFAULT_INPUT_HANDLE: NodeHandleDefinition = {
    id: 'input',
    type: 'target',
    label: 'Input',
    defaultPlacement: {
        side: 'left',
        offset: 50
    }
};

const DEFAULT_OUTPUT_HANDLE: NodeHandleDefinition = {
    id: 'output',
    type: 'source',
    label: 'Output',
    defaultPlacement: {
        side: 'right',
        offset: 50
    }
};

const NODE_HANDLE_DEFINITIONS: Record<NodeType, NodeHandleDefinition[]> = {
    [NodeType.MODIFIER]: [
        DEFAULT_OUTPUT_HANDLE
    ],
    [NodeType.ARGUMENTS]: [
        DEFAULT_INPUT_HANDLE,
        DEFAULT_OUTPUT_HANDLE
    ],
    [NodeType.CONTEXT]: [
        DEFAULT_INPUT_HANDLE,
        DEFAULT_OUTPUT_HANDLE
    ],
    [NodeType.FOREACH]: [
        DEFAULT_INPUT_HANDLE,
        DEFAULT_OUTPUT_HANDLE
    ],
    [NodeType.ENTRYPOINT]: [
        DEFAULT_INPUT_HANDLE,
        DEFAULT_OUTPUT_HANDLE
    ],
    [NodeType.PLUGIN]: [
        DEFAULT_INPUT_HANDLE,
        DEFAULT_OUTPUT_HANDLE
    ],
    [NodeType.EXPOSURE]: [
        DEFAULT_INPUT_HANDLE,
        DEFAULT_OUTPUT_HANDLE
    ],
    [NodeType.EXPORT]: [
        DEFAULT_INPUT_HANDLE
    ],
    [NodeType.IF_STATEMENT]: [
        DEFAULT_INPUT_HANDLE,
        {
            id: 'output-true',
            type: 'source',
            label: 'True Branch',
            className: 'if-statement-handle if-statement-handle--true',
            defaultPlacement: {
                side: 'right',
                offset: 35
            }
        },
        {
            id: 'output-false',
            type: 'source',
            label: 'False Branch',
            className: 'if-statement-handle if-statement-handle--false',
            defaultPlacement: {
                side: 'right',
                offset: 65
            }
        }
    ],
    [NodeType.SWITCH_STATEMENT]: [
        DEFAULT_INPUT_HANDLE,
        {
            id: 'cases',
            type: 'source',
            label: 'Cases Output',
            className: 'switch-statement-handle switch-statement-handle--cases',
            defaultPlacement: {
                side: 'right',
                offset: 35
            }
        },
        {
            id: 'continue',
            type: 'source',
            label: 'Continue Output',
            className: 'switch-statement-handle switch-statement-handle--continue',
            defaultPlacement: {
                side: 'right',
                offset: 65
            }
        }
    ],
    [NodeType.SWITCH_CASE]: [
        DEFAULT_INPUT_HANDLE,
        DEFAULT_OUTPUT_HANDLE
    ]
};

export const CONNECTOR_SIDE_OPTIONS: SelectOption[] = [{
    value: 'left',
    title: 'Left'
}, {
    value: 'right',
    title: 'Right'
}, {
    value: 'top',
    title: 'Top'
}, {
    value: 'bottom',
    title: 'Bottom'
}];

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isConnectorSide = (value: unknown): value is NodeConnectorSide => {
    return value === 'left' || value === 'right' || value === 'top' || value === 'bottom';
};

const clampConnectorOffset = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.min(100, Math.max(0, value));
};

export const getNodeHandleDefinitions = (nodeType: NodeType): NodeHandleDefinition[] => {
    return NODE_HANDLE_DEFINITIONS[nodeType] ?? [];
};

export const readNodeConnectorLayout = (data: INodeData | undefined): INodeConnectorLayout => {
    if (!isRecord(data?.connectorLayout)) {
        return {};
    }

    return data.connectorLayout as INodeConnectorLayout;
};

export const resolveNodeHandlePlacement = (
    data: INodeData | undefined,
    handleDefinition: NodeHandleDefinition
): INodeConnectorPlacement => {
    const connectorLayout = readNodeConnectorLayout(data);
    const rawPlacement = connectorLayout[handleDefinition.id];

    if (!isRecord(rawPlacement)) {
        return handleDefinition.defaultPlacement;
    }

    return {
        side: isConnectorSide(rawPlacement.side)
            ? rawPlacement.side
            : handleDefinition.defaultPlacement.side,
        offset: clampConnectorOffset(
            rawPlacement.offset,
            handleDefinition.defaultPlacement.offset
        )
    };
};

export const createNodeHandlePlacement = (
    placement: Partial<INodeConnectorPlacement>,
    handleDefinition: NodeHandleDefinition
): INodeConnectorPlacement => {
    return {
        side: isConnectorSide(placement.side)
            ? placement.side
            : handleDefinition.defaultPlacement.side,
        offset: clampConnectorOffset(
            placement.offset,
            handleDefinition.defaultPlacement.offset
        )
    };
};

export const toReactFlowHandlePosition = (side: NodeConnectorSide): Position => {
    switch (side) {
        case 'left':
            return Position.Left;
        case 'right':
            return Position.Right;
        case 'top':
            return Position.Top;
        case 'bottom':
            return Position.Bottom;
        default:
            return Position.Right;
    }
};

export const createReactFlowHandleStyle = (
    placement: INodeConnectorPlacement
): CSSProperties => {
    if (placement.side === 'left' || placement.side === 'right') {
        return { top: `${placement.offset}%` };
    }

    return { left: `${placement.offset}%` };
};
