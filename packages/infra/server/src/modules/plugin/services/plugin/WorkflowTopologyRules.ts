import {
    containsPluginReferenceArgument,
    readArgumentDefinitions
} from '@modules/plugin/services/plugin/ArgumentDefinitionValidator';
import {
    hasAncestorOfType,
    type WorkflowTopologyIndex
} from '@modules/plugin/services/plugin/WorkflowTopologyIndex';
import { NodeType, PluginNodeExecutionMode } from '@volt/contracts/modules/plugin/enums';
import type { IWorkflowNode, IWorkflow } from '@volt/contracts/modules/plugin/workflow';

const RUNTIME_REACHABLE_ANCESTORS = new Set<NodeType>([
    NodeType.CONTEXT,
    NodeType.FOREACH
]);

export const validateIfStatementTopology = (
    workflow: IWorkflow,
    errors: string[],
    topology: WorkflowTopologyIndex
): void => {
    for (const node of workflow.nodes) {
        if (node.type !== NodeType.IF_STATEMENT) {
            continue;
        }

        const outgoingEdges = topology.childrenBySource.get(node.id) ?? [];
        const hasInvalidBranch = outgoingEdges.some((edge) => {
            return edge.sourceHandle !== undefined
                && edge.sourceHandle !== 'output-true'
                && edge.sourceHandle !== 'output-false';
        });
        if (hasInvalidBranch) {
            errors.push(`If statement ${node.id} has invalid branch handles`);
        }
    }
};

export const validateSwitchStatementTopology = (
    workflow: IWorkflow,
    errors: string[],
    topology: WorkflowTopologyIndex
): void => {
    const { nodeMap, parentsByTarget, childrenBySource } = topology;

    for (const node of workflow.nodes) {
        if (node.type !== NodeType.SWITCH_STATEMENT) {
            continue;
        }

        const outgoingEdges = childrenBySource.get(node.id) ?? [];
        if (outgoingEdges.some((edge) => edge.sourceHandle !== 'cases' && edge.sourceHandle !== 'continue')) {
            errors.push(`Switch statement ${node.id} must only use "cases" or "continue" handles`);
        }

        const caseEdges = outgoingEdges.filter((edge) => edge.sourceHandle === 'cases');
        if (caseEdges.length === 0) {
            errors.push(`Switch statement ${node.id} must connect at least one switch case`);
        }

        const caseNodes = caseEdges
            .map((edge) => nodeMap.get(edge.target))
            .filter((candidate): candidate is IWorkflowNode => Boolean(candidate));
        if (caseNodes.some((candidate) => candidate.type !== NodeType.SWITCH_CASE)) {
            errors.push(`Switch statement ${node.id} can only connect its "cases" handle to switch case nodes`);
        }

        const defaultCaseCount = caseNodes.filter((caseNode) => caseNode.data.switchCase?.defaultCase === true).length;
        if (defaultCaseCount > 1) {
            errors.push(`Switch statement ${node.id} cannot have more than one default case`);
        }
    }

    for (const node of workflow.nodes) {
        if (node.type !== NodeType.SWITCH_CASE) {
            continue;
        }

        const parentEdges = parentsByTarget.get(node.id) ?? [];
        if (parentEdges.length !== 1) {
            errors.push(`Switch case ${node.id} must have exactly one parent switch statement`);
            continue;
        }

        const parentNode = nodeMap.get(parentEdges[0].source);
        if (parentNode?.type !== NodeType.SWITCH_STATEMENT || parentEdges[0].sourceHandle !== 'cases') {
            errors.push(`Switch case ${node.id} must be connected from a switch statement "cases" handle`);
        }
    }
};

export const validatePluginNodeTopology = (
    workflow: IWorkflow,
    errors: string[],
    topology: WorkflowTopologyIndex
): void => {
    const argumentsDefinitions = readArgumentDefinitions(workflow);

    for (const node of workflow.nodes) {
        if (node.type !== NodeType.PLUGIN) {
            continue;
        }

        const pluginNodeData = node.data.pluginNode;
        const pluginId = pluginNodeData?.pluginId?.trim() ?? '';
        const argumentReference = pluginNodeData?.argumentReference?.trim() ?? '';
        const executionMode = pluginNodeData?.executionMode
            ?? (!pluginId && argumentReference
                ? PluginNodeExecutionMode.ARGUMENT_REFERENCE
                : PluginNodeExecutionMode.MANUAL);

        if (executionMode === PluginNodeExecutionMode.MANUAL && !pluginId) {
            errors.push(`Plugin node ${node.id} must reference a published plugin`);
        }

        if (executionMode === PluginNodeExecutionMode.ARGUMENT_REFERENCE) {
            if (!argumentReference) {
                errors.push(`Plugin node ${node.id} must define an arguments reference`);
            } else {
                const referencedArgument = argumentsDefinitions.find((definition) => definition.argument === argumentReference);
                if (!referencedArgument || !containsPluginReferenceArgument(referencedArgument)) {
                    errors.push(`Plugin node ${node.id} references unknown plugin argument "${argumentReference}"`);
                }
            }
        }

        const parentEdges = topology.parentsByTarget.get(node.id) ?? [];
        if (parentEdges.length !== 1) {
            errors.push(`Plugin node ${node.id} must have exactly one incoming runtime connection`);
        }

        if (!hasAncestorOfType(node.id, topology, RUNTIME_REACHABLE_ANCESTORS)) {
            errors.push(`Plugin node ${node.id} must run after the workflow planning segment`);
        }
    }
};

export const validateEntrypointTopology = (
    workflow: IWorkflow,
    errors: string[],
    topology: WorkflowTopologyIndex
): void => {
    const entrypointNodes = workflow.nodes.filter((node) => node.type === NodeType.ENTRYPOINT);
    if (entrypointNodes.length !== 1) {
        errors.push('Workflow must have exactly one top-level entrypoint');
        return;
    }

    const entrypointNode = entrypointNodes[0];
    const parentEdges = topology.parentsByTarget.get(entrypointNode.id) ?? [];
    if (parentEdges.length !== 1) {
        errors.push(`Top-level entrypoint ${entrypointNode.id} must have exactly one incoming runtime connection`);
    }

    if (!hasAncestorOfType(entrypointNode.id, topology, RUNTIME_REACHABLE_ANCESTORS)) {
        errors.push(`Top-level entrypoint ${entrypointNode.id} must run after the planning segment`);
    }
};
