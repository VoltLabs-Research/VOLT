import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import type { WorkflowTopologyIndex } from '@modules/plugin/services/plugin/WorkflowTopologyIndex';


const BRANCH_CONTINUATION_TARGETS = new Set<WorkflowNodeType>([
    WorkflowNodeType.Plugin,
    WorkflowNodeType.Entrypoint,
    WorkflowNodeType.Exposure,
    WorkflowNodeType.Export,
    WorkflowNodeType.IfStatement,
    WorkflowNodeType.SwitchStatement
]);

const ALLOWED_EDGE_TARGETS = new Map<WorkflowNodeType, ReadonlySet<WorkflowNodeType>>([
    [WorkflowNodeType.Modifier, new Set([WorkflowNodeType.Arguments])],
    [WorkflowNodeType.Arguments, new Set([WorkflowNodeType.Context])],
    [WorkflowNodeType.Context, new Set([
        WorkflowNodeType.ForEach,
        WorkflowNodeType.Entrypoint,
        WorkflowNodeType.Plugin,
        WorkflowNodeType.IfStatement,
        WorkflowNodeType.SwitchStatement
    ])],
    [WorkflowNodeType.ForEach, new Set([
        WorkflowNodeType.Entrypoint,
        WorkflowNodeType.Plugin,
        WorkflowNodeType.IfStatement,
        WorkflowNodeType.SwitchStatement
    ])],
    [WorkflowNodeType.Entrypoint, new Set([
        WorkflowNodeType.Exposure,
        WorkflowNodeType.IfStatement,
        WorkflowNodeType.SwitchStatement
    ])],
    [WorkflowNodeType.Plugin, new Set([
        WorkflowNodeType.Plugin,
        WorkflowNodeType.Entrypoint,
        WorkflowNodeType.IfStatement,
        WorkflowNodeType.SwitchStatement
    ])],
    [WorkflowNodeType.Exposure, new Set([WorkflowNodeType.Export])],
    [WorkflowNodeType.Export, new Set()],
    [WorkflowNodeType.IfStatement, BRANCH_CONTINUATION_TARGETS],
    [WorkflowNodeType.SwitchCase, BRANCH_CONTINUATION_TARGETS]
]);

const SWITCH_CASE_TARGETS = new Set<WorkflowNodeType>([
    WorkflowNodeType.SwitchCase
]);

const NODES_ALLOWING_MULTIPLE_PARENTS = new Set<WorkflowNodeType>([
    WorkflowNodeType.Modifier,
    WorkflowNodeType.Arguments,
    WorkflowNodeType.Context,
    WorkflowNodeType.ForEach
]);

const isAllowedEdge = (
    sourceType: WorkflowNodeType,
    targetType: WorkflowNodeType,
    sourceHandle?: string
): boolean => {
    if (sourceType === WorkflowNodeType.SwitchStatement) {
        const targets = sourceHandle === 'cases'
            ? SWITCH_CASE_TARGETS
            : BRANCH_CONTINUATION_TARGETS;
        return targets.has(targetType);
    }

    return ALLOWED_EDGE_TARGETS.get(sourceType)?.has(targetType) ?? false;
};

export const validateRuntimeEdgeTopology = (
    workflow: WorkflowProps,
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
