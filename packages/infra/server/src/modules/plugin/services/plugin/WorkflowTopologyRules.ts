import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import {
    PluginNodeExecutionMode,
    WorkflowNodeType,
    type WorkflowNode
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import {
    containsPluginReferenceArgument,
    readArgumentDefinitions
} from '@modules/plugin/services/plugin/ArgumentDefinitionValidator';
import {
    hasAncestorOfType,
    type WorkflowTopologyIndex
} from '@modules/plugin/services/plugin/WorkflowTopologyIndex';

const RUNTIME_REACHABLE_ANCESTORS = new Set<WorkflowNodeType>([
    WorkflowNodeType.Context,
    WorkflowNodeType.ForEach
]);

export const validateIfStatementTopology = (
    workflow: WorkflowProps,
    errors: string[],
    topology: WorkflowTopologyIndex
): void => {
    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.IfStatement) {
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
    workflow: WorkflowProps,
    errors: string[],
    topology: WorkflowTopologyIndex
): void => {
    const { nodeMap, parentsByTarget, childrenBySource } = topology;

    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.SwitchStatement) {
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
            .filter((candidate): candidate is WorkflowNode => Boolean(candidate));
        if (caseNodes.some((candidate) => candidate.type !== WorkflowNodeType.SwitchCase)) {
            errors.push(`Switch statement ${node.id} can only connect its "cases" handle to switch case nodes`);
        }

        const defaultCaseCount = caseNodes.filter((caseNode) => caseNode.data.switchCase?.defaultCase === true).length;
        if (defaultCaseCount > 1) {
            errors.push(`Switch statement ${node.id} cannot have more than one default case`);
        }
    }

    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.SwitchCase) {
            continue;
        }

        const parentEdges = parentsByTarget.get(node.id) ?? [];
        if (parentEdges.length !== 1) {
            errors.push(`Switch case ${node.id} must have exactly one parent switch statement`);
            continue;
        }

        const parentNode = nodeMap.get(parentEdges[0].source);
        if (parentNode?.type !== WorkflowNodeType.SwitchStatement || parentEdges[0].sourceHandle !== 'cases') {
            errors.push(`Switch case ${node.id} must be connected from a switch statement "cases" handle`);
        }
    }
};

export const validatePluginNodeTopology = (
    workflow: WorkflowProps,
    errors: string[],
    topology: WorkflowTopologyIndex
): void => {
    const argumentsDefinitions = readArgumentDefinitions(workflow);

    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.Plugin) {
            continue;
        }

        const pluginNodeData = node.data.pluginNode;
        const pluginId = pluginNodeData?.pluginId?.trim() ?? '';
        const argumentReference = pluginNodeData?.argumentReference?.trim() ?? '';
        const executionMode = pluginNodeData?.executionMode
            ?? (!pluginId && argumentReference
                ? PluginNodeExecutionMode.ArgumentReference
                : PluginNodeExecutionMode.Manual);

        if (executionMode === PluginNodeExecutionMode.Manual && !pluginId) {
            errors.push(`Plugin node ${node.id} must reference a published plugin`);
        }

        if (executionMode === PluginNodeExecutionMode.ArgumentReference) {
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
    workflow: WorkflowProps,
    errors: string[],
    topology: WorkflowTopologyIndex
): void => {
    const entrypointNodes = workflow.nodes.filter((node) => node.type === WorkflowNodeType.Entrypoint);
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
