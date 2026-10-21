import type { WorkflowTopologyIndex } from '@modules/plugin/services/plugin/WorkflowTopologyIndex';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflow } from '@volt/contracts/modules/plugin/workflow';


const BRANCH_CONTINUATION_TARGETS = new Set<NodeType>([
    NodeType.PLUGIN,
    NodeType.ENTRYPOINT,
    NodeType.EXPOSURE,
    NodeType.EXPORT,
    NodeType.IF_STATEMENT,
    NodeType.SWITCH_STATEMENT
]);

const ALLOWED_EDGE_TARGETS = new Map<NodeType, ReadonlySet<NodeType>>([
    [NodeType.MODIFIER, new Set([NodeType.ARGUMENTS])],
    [NodeType.ARGUMENTS, new Set([NodeType.CONTEXT])],
    [NodeType.CONTEXT, new Set([
        NodeType.FOREACH,
        NodeType.ENTRYPOINT,
        NodeType.PLUGIN,
        NodeType.IF_STATEMENT,
        NodeType.SWITCH_STATEMENT
    ])],
    [NodeType.FOREACH, new Set([
        NodeType.ENTRYPOINT,
        NodeType.PLUGIN,
        NodeType.IF_STATEMENT,
        NodeType.SWITCH_STATEMENT
    ])],
    [NodeType.ENTRYPOINT, new Set([
        NodeType.EXPOSURE,
        NodeType.IF_STATEMENT,
        NodeType.SWITCH_STATEMENT
    ])],
    [NodeType.PLUGIN, new Set([
        NodeType.PLUGIN,
        NodeType.ENTRYPOINT,
        NodeType.IF_STATEMENT,
        NodeType.SWITCH_STATEMENT
    ])],
    [NodeType.EXPOSURE, new Set([NodeType.EXPORT])],
    [NodeType.EXPORT, new Set()],
    [NodeType.IF_STATEMENT, BRANCH_CONTINUATION_TARGETS],
    [NodeType.SWITCH_CASE, BRANCH_CONTINUATION_TARGETS]
]);

const SWITCH_CASE_TARGETS = new Set<NodeType>([
    NodeType.SWITCH_CASE
]);

const NODES_ALLOWING_MULTIPLE_PARENTS = new Set<NodeType>([
    NodeType.MODIFIER,
    NodeType.ARGUMENTS,
    NodeType.CONTEXT,
    NodeType.FOREACH
]);

const isAllowedEdge = (
    sourceType: NodeType,
    targetType: NodeType,
    sourceHandle?: string
): boolean => {
    if (sourceType === NodeType.SWITCH_STATEMENT) {
        const targets = sourceHandle === 'cases'
            ? SWITCH_CASE_TARGETS
            : BRANCH_CONTINUATION_TARGETS;
        return targets.has(targetType);
    }

    return ALLOWED_EDGE_TARGETS.get(sourceType)?.has(targetType) ?? false;
};

export const validateRuntimeEdgeTopology = (
    workflow: IWorkflow,
    errors: string[],
    topology: WorkflowTopologyIndex
): void => {
    const { nodeMap, parentsByTarget } = topology;

    for (const edge of workflow.edges) {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!sourceNode || !targetNode) {
            continue;
        }

        if (!isAllowedEdge(sourceNode.type, targetNode.type, edge.sourceHandle)) {
            errors.push(`Edge ${edge.source} -> ${edge.target} is not valid for node types ${sourceNode.type} -> ${targetNode.type}`);
        }
    }

    for (const node of workflow.nodes) {
        if (NODES_ALLOWING_MULTIPLE_PARENTS.has(node.type)) {
            continue;
        }

        const parents = parentsByTarget.get(node.id) ?? [];
        if (parents.length > 1) {
            errors.push(`Node ${node.id} does not support multiple incoming connections`);
        }
    }
};
