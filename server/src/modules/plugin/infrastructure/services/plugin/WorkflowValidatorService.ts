import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import Workflow, { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { WorkflowEdge } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowEdge';
import { WorkflowNode, WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import {
    ArgumentType, ArgumentVisibilityOperators,
    type ArgumentDefinition
} from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import { EntrypointNodeType } from '@modules/plugin/domain/entities/plugin/workflow/nodes/EntrypointNode';
import { PluginNodeExecutionMode } from '@modules/plugin/domain/entities/plugin/workflow/nodes/PluginNode';
import {
    IWorkflowValidatorService,
    WorkflowValidationMode,
    WorkflowValidationResult
} from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import { PluginDependencyResolverService } from '@modules/plugin/infrastructure/services/plugin/PluginDependencyResolverService';
import { Singleton } from '@shared/infrastructure/di/decorators';

const RUNTIME_REACHABLE_ANCESTORS = new Set<WorkflowNodeType>([
    WorkflowNodeType.Context,
    WorkflowNodeType.ForEach
]);

const isAllowedSwitchHandle = (handle: string | undefined): boolean => {
    return handle === 'cases' || handle === 'continue';
};

const resolvePluginNodeExecutionMode = (
    pluginNodeData: {
        executionMode?: unknown;
        pluginId?: unknown;
        argumentReference?: unknown;
    }
): PluginNodeExecutionMode => {
    if (pluginNodeData.executionMode === PluginNodeExecutionMode.ArgumentReference) {
        return PluginNodeExecutionMode.ArgumentReference;
    }

    if (pluginNodeData.executionMode === PluginNodeExecutionMode.Manual) {
        return PluginNodeExecutionMode.Manual;
    }

    const pluginId = typeof pluginNodeData.pluginId === 'string'
        ? pluginNodeData.pluginId.trim()
        : '';
    const argumentReference = typeof pluginNodeData.argumentReference === 'string'
        ? pluginNodeData.argumentReference.trim()
        : '';

    if (!pluginId && argumentReference) {
        return PluginNodeExecutionMode.ArgumentReference;
    }

    return PluginNodeExecutionMode.Manual;
};

@Singleton()
export class WorkflowValidatorService implements IWorkflowValidatorService {
    constructor(
        private readonly pluginDependencyResolverService: PluginDependencyResolverService
    ) {}

    async validate(
        workflow: WorkflowProps,
        currentPluginId?: string,
        mode: WorkflowValidationMode = WorkflowValidationMode.Strict
    ): Promise<WorkflowValidationResult> {
        const errors: string[] = [];
        let modifier: WorkflowNode | undefined;
        const pluginNodes = workflow?.nodes?.filter((node) => node.type === WorkflowNodeType.Plugin) ?? [];

        if (!workflow || !workflow.nodes || !Array.isArray(workflow.nodes)) {
            errors.push('Workflow must have a nodes array');
            return { isValid: false, errors };
        }

        const pluginReferences = workflow.nodes
            .filter((node) => node.type === WorkflowNodeType.Plugin)
            .map((node) => ({
                nodeId: node.id,
                pluginId: node.data.pluginNode?.pluginId?.trim() ?? ''
            }))
            .filter((reference) => Boolean(reference.pluginId));

        const modifierNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Modifier);
        if (!modifierNode) {
            errors.push('Workflow must have a modifier node');
        } else {
            modifier = modifierNode;
        }

        this.validateArgumentDefinitions(this.getArgumentsDefinitions(workflow), errors);

        if (!workflow.edges || !Array.isArray(workflow.edges)) {
            errors.push('Workflow must have edges array');
        }

        if (Array.isArray(workflow.edges)) {
            this.validateRuntimeEdgeTopology(workflow, errors);
            this.validateIfStatementTopology(workflow, errors);
            this.validateSwitchStatementTopology(workflow, errors);
            this.validateEntrypointTopology(workflow, errors);
        }

        if (pluginNodes.length > 0 && Array.isArray(workflow.edges)) {
            this.validatePluginNodeTopology(workflow, errors);
        }

        const nodeIds = new Set(workflow.nodes.map((node) => node.id));
        for (const edge of workflow.edges || []) {
            if (!nodeIds.has(edge.source)) {
                errors.push(`Edge references unknown source node: ${edge.source}`);
            }
            if (!nodeIds.has(edge.target)) {
                errors.push(`Edge references unknown target node: ${edge.target}`);
            }
        }

        if (workflow.nodes.length > 0 && workflow.edges?.length > 0) {
            if (this.hasCycle(workflow.nodes, workflow.edges)) {
                errors.push('Workflow contains a cycle');
            }
        }

        if (currentPluginId) {
            for (const reference of pluginReferences) {
                if (reference.pluginId === currentPluginId) {
                    errors.push(`Plugin node ${reference.nodeId} cannot reference the current plugin`);
                }
            }
        }

        if (!errors.length && mode === WorkflowValidationMode.Strict) {
            this.validateRuntimeReadiness(workflow, errors);
        }

        if (!errors.length && mode === WorkflowValidationMode.Strict) {
            const rootPluginId = currentPluginId ?? '__draft_plugin__';
            const transientPlugin = new Plugin(rootPluginId, {
                team: '',
                workflow: new Workflow(rootPluginId, workflow),
                status: PluginStatus.Draft,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const dependencyValidation = await this.pluginDependencyResolverService.collectTransitivePublishedDependencies(transientPlugin);
            errors.push(...dependencyValidation.errors);
        }

        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            modifier,
            pluginReferences
        };
    }

    private validateRuntimeReadiness(workflow: WorkflowProps, errors: string[]): void {
        const entrypointNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
        if (!entrypointNode) {
            return;
        }

        const entrypointData = entrypointNode.data?.entrypoint as Record<string, unknown> | undefined;
        if (!entrypointData) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} is missing runtime configuration`);
            return;
        }

        const binaryObjectPath = typeof entrypointData.binaryObjectPath === 'string'
            ? entrypointData.binaryObjectPath.trim()
            : '';
        const argumentsTemplate = typeof entrypointData.arguments === 'string'
            ? entrypointData.arguments.trim()
            : '';
        const entrypointType = entrypointData.type === EntrypointNodeType.PythonScript
            ? EntrypointNodeType.PythonScript
            : entrypointData.type === EntrypointNodeType.PackagedExecutable
                ? EntrypointNodeType.PackagedExecutable
            : EntrypointNodeType.Executable;

        if (!binaryObjectPath) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} requires an uploaded binary`);
        }

        if (!argumentsTemplate) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} must define execution arguments`);
        }

        if (
            entrypointType === EntrypointNodeType.PythonScript
            || entrypointType === EntrypointNodeType.PackagedExecutable
        ) {
            const entrypointScript = typeof entrypointData.entrypointScript === 'string'
                ? entrypointData.entrypointScript.trim()
                : '';

            if (!entrypointScript) {
                errors.push(`Top-level entrypoint ${entrypointNode.id} must define an entrypoint script`);
            }
        }
    }

    private hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
        const adjacency = new Map<string, string[]>();
        for (const node of nodes) {
            adjacency.set(node.id, []);
        }

        for (const edge of edges) {
            adjacency.get(edge.source)?.push(edge.target);
        }

        const visited = new Set<string>();
        const stack = new Set<string>();

        const dfs = (nodeId: string): boolean => {
            visited.add(nodeId);
            stack.add(nodeId);

            for (const neighbor of adjacency.get(nodeId) || []) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) return true;
                } else if (stack.has(neighbor)) {
                    return true;
                }
            }

            stack.delete(nodeId);
            return false;
        };

        for (const node of nodes) {
            if (!visited.has(node.id)) {
                if (dfs(node.id)) return true;
            }
        }

        return false;
    }

    private validateRuntimeEdgeTopology(workflow: WorkflowProps, errors: string[]): void {
        const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));

        for (const edge of workflow.edges) {
            const sourceNode = nodeMap.get(edge.source);
            const targetNode = nodeMap.get(edge.target);
            if (!sourceNode || !targetNode) {
                continue;
            }

            if (!this.isAllowedEdge(sourceNode.type, targetNode.type, edge.sourceHandle)) {
                errors.push(`Edge ${edge.source} -> ${edge.target} is not valid for node types ${sourceNode.type} -> ${targetNode.type}`);
            }
        }

        for (const node of workflow.nodes) {
            if (
                node.type === WorkflowNodeType.Modifier
                || node.type === WorkflowNodeType.Arguments
                || node.type === WorkflowNodeType.Context
                || node.type === WorkflowNodeType.ForEach
            ) {
                continue;
            }

            const parents = workflow.edges.filter((edge) => edge.target === node.id);
            if (node.type === WorkflowNodeType.Entrypoint || node.type === WorkflowNodeType.Plugin || node.type === WorkflowNodeType.IfStatement || node.type === WorkflowNodeType.SwitchStatement || node.type === WorkflowNodeType.SwitchCase || node.type === WorkflowNodeType.Exposure || node.type === WorkflowNodeType.Export) {
                if (parents.length > 1) {
                    errors.push(`Node ${node.id} does not support multiple incoming connections`);
                }
            }
        }
    }

    private validateIfStatementTopology(workflow: WorkflowProps, errors: string[]): void {
        for (const node of workflow.nodes) {
            if (node.type !== WorkflowNodeType.IfStatement) {
                continue;
            }

            const outgoingEdges = workflow.edges.filter((edge) => edge.source === node.id);
            const invalidEdges = outgoingEdges.filter((edge) => {
                return typeof edge.sourceHandle !== 'undefined'
                    && edge.sourceHandle !== 'output-true'
                    && edge.sourceHandle !== 'output-false'
                    && edge.sourceHandle !== 'true'
                    && edge.sourceHandle !== 'false';
            });
            if (invalidEdges.length > 0) {
                errors.push(`If statement ${node.id} has invalid branch handles`);
            }
        }
    }

    private validateSwitchStatementTopology(workflow: WorkflowProps, errors: string[]): void {
        const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));

        for (const node of workflow.nodes) {
            if (node.type !== WorkflowNodeType.SwitchStatement) {
                continue;
            }

            const outgoingEdges = workflow.edges.filter((edge) => edge.source === node.id);
            const invalidHandles = outgoingEdges.filter((edge) => !isAllowedSwitchHandle(edge.sourceHandle));
            if (invalidHandles.length > 0) {
                errors.push(`Switch statement ${node.id} must only use "cases" or "continue" handles`);
            }

            const caseEdges = outgoingEdges.filter((edge) => edge.sourceHandle === 'cases');
            if (caseEdges.length === 0) {
                errors.push(`Switch statement ${node.id} must connect at least one switch case`);
            }

            const caseNodes = caseEdges
                .map((edge) => nodeMap.get(edge.target))
                .filter((candidate): candidate is WorkflowNode => Boolean(candidate));
            const invalidCaseTargets = caseNodes.filter((candidate) => candidate.type !== WorkflowNodeType.SwitchCase);
            if (invalidCaseTargets.length > 0) {
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

            const parentEdges = workflow.edges.filter((edge) => edge.target === node.id);
            if (parentEdges.length !== 1) {
                errors.push(`Switch case ${node.id} must have exactly one parent switch statement`);
                continue;
            }

            const parentNode = nodeMap.get(parentEdges[0].source);
            if (parentNode?.type !== WorkflowNodeType.SwitchStatement || parentEdges[0].sourceHandle !== 'cases') {
                errors.push(`Switch case ${node.id} must be connected from a switch statement "cases" handle`);
            }
        }
    }

    private validatePluginNodeTopology(workflow: WorkflowProps, errors: string[]): void {
        const argumentsDefinitions = this.getArgumentsDefinitions(workflow);

        for (const node of workflow.nodes) {
            if (node.type !== WorkflowNodeType.Plugin) {
                continue;
            }

            const pluginNodeData = node.data.pluginNode ?? {};
            const executionMode = resolvePluginNodeExecutionMode(pluginNodeData);

            if (executionMode === PluginNodeExecutionMode.Manual) {
                const pluginId = typeof pluginNodeData.pluginId === 'string'
                    ? pluginNodeData.pluginId.trim()
                    : '';
                if (!pluginId) {
                    errors.push(`Plugin node ${node.id} must reference a published plugin`);
                }
            }

            if (executionMode === PluginNodeExecutionMode.ArgumentReference) {
                const argumentReference = typeof pluginNodeData.argumentReference === 'string'
                    ? pluginNodeData.argumentReference.trim()
                    : '';
                if (!argumentReference) {
                    errors.push(`Plugin node ${node.id} must define an arguments reference`);
                } else {
                    const referencedArgument = argumentsDefinitions.find((definition) => definition.argument === argumentReference);
                    if (!referencedArgument || referencedArgument.type !== ArgumentType.PluginReference) {
                        errors.push(`Plugin node ${node.id} references unknown plugin argument "${argumentReference}"`);
                    }
                }
            }

            const parentEdges = workflow.edges.filter((edge) => edge.target === node.id);
            if (parentEdges.length !== 1) {
                errors.push(`Plugin node ${node.id} must have exactly one incoming runtime connection`);
            }

            if (!this.hasAncestorOfType(node.id, workflow, RUNTIME_REACHABLE_ANCESTORS)) {
                errors.push(`Plugin node ${node.id} must run after the workflow planning segment`);
            }
        }
    }

    private validateEntrypointTopology(workflow: WorkflowProps, errors: string[]): void {
        const entrypointNodes = workflow.nodes.filter((node) => node.type === WorkflowNodeType.Entrypoint);
        if (entrypointNodes.length !== 1) {
            errors.push('Workflow must have exactly one top-level entrypoint');
            return;
        }

        const entrypointNode = entrypointNodes[0];
        const parentEdges = workflow.edges.filter((edge) => edge.target === entrypointNode.id);
        if (parentEdges.length !== 1) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} must have exactly one incoming runtime connection`);
        }

        if (!this.hasAncestorOfType(entrypointNode.id, workflow, RUNTIME_REACHABLE_ANCESTORS)) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} must run after the planning segment`);
        }
    }

    private getArgumentsDefinitions(workflow: WorkflowProps): ArgumentDefinition[] {
        const argumentsNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
        return Array.isArray(argumentsNode?.data.arguments?.arguments)
            ? argumentsNode.data.arguments.arguments as ArgumentDefinition[]
            : [];
    }

    private validateArgumentDefinitions(
        definitions: ArgumentDefinition[],
        errors: string[],
        scope = 'arguments'
    ): void {
        for (const definition of definitions) {
            const argumentKey = definition.argument?.trim() || '<unnamed>';
            const argumentScope = `${scope}.${argumentKey}`;
            const visibleWhen = definition.visibleWhen;

            if (visibleWhen) {
                const controllingArgument = visibleWhen.argument?.trim() || '';
                if (!controllingArgument) {
                    errors.push(`${argumentScope} visibleWhen.argument is required`);
                } else if (controllingArgument === definition.argument) {
                    errors.push(`${argumentScope} cannot depend on itself`);
                } else if (!definitions.some((candidate) => candidate.argument === controllingArgument)) {
                    errors.push(`${argumentScope} references unknown visibility argument "${controllingArgument}"`);
                }

                if (!ArgumentVisibilityOperators.includes(visibleWhen.operator)) {
                    errors.push(`${argumentScope} uses unsupported visibility operator "${visibleWhen.operator}"`);
                }

                if (
                    (visibleWhen.operator === 'equals' || visibleWhen.operator === 'notEquals')
                    && typeof visibleWhen.value === 'undefined'
                ) {
                    errors.push(`${argumentScope} requires visibleWhen.value for operator "${visibleWhen.operator}"`);
                }

                if (
                    (visibleWhen.operator === 'in' || visibleWhen.operator === 'notIn')
                    && (!Array.isArray(visibleWhen.values) || visibleWhen.values.length === 0)
                ) {
                    errors.push(`${argumentScope} requires visibleWhen.values for operator "${visibleWhen.operator}"`);
                }
            }

            if (definition.type === ArgumentType.PluginReference && definition.pluginReferenceMappings !== undefined) {
                if (!Array.isArray(definition.pluginReferenceMappings)) {
                    errors.push(`${argumentScope} pluginReferenceMappings must be an array`);
                } else {
                    definition.pluginReferenceMappings.forEach((mapping, mappingIndex) => {
                        const mappingScope = `${argumentScope}.pluginReferenceMappings[${mappingIndex}]`;
                        const sourceArgument = typeof mapping.sourceArgument === 'string'
                            ? mapping.sourceArgument.trim()
                            : '';
                        const targetArgument = typeof mapping.targetArgument === 'string'
                            ? mapping.targetArgument.trim()
                            : '';
                        if (!sourceArgument) {
                            errors.push(`${mappingScope} sourceArgument is required`);
                        } else if (!definitions.some((candidate) => candidate.argument === sourceArgument)) {
                            errors.push(`${mappingScope} references unknown source argument "${sourceArgument}"`);
                        }

                        if (!targetArgument) {
                            errors.push(`${mappingScope} targetArgument is required`);
                        }

                        if (mapping.valueMap !== undefined && (typeof mapping.valueMap !== 'object' || mapping.valueMap === null || Array.isArray(mapping.valueMap))) {
                            errors.push(`${mappingScope} valueMap must be an object`);
                        }
                    });
                }
            }

            if (definition.listArguments?.length) {
                this.validateArgumentDefinitions(definition.listArguments, errors, argumentScope);
            }
        }
    }

    private hasAncestorOfType(nodeId: string, workflow: WorkflowProps, blockedTypes: Set<WorkflowNodeType>): boolean {
        const visited = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
            const currentNodeId = queue.shift() as string;
            if (visited.has(currentNodeId)) {
                continue;
            }

            visited.add(currentNodeId);
            const parentEdges = workflow.edges.filter((edge) => edge.target === currentNodeId);
            for (const edge of parentEdges) {
                const parentNode = workflow.nodes.find((candidate) => candidate.id === edge.source);
                if (!parentNode) {
                    continue;
                }

                if (blockedTypes.has(parentNode.type)) {
                    return true;
                }

                queue.push(parentNode.id);
            }
        }

        return false;
    }

    private isAllowedEdge(
        sourceType: WorkflowNodeType,
        targetType: WorkflowNodeType,
        sourceHandle?: string
    ): boolean {
        if (sourceType === WorkflowNodeType.Modifier) {
            return targetType === WorkflowNodeType.Arguments;
        }

        if (sourceType === WorkflowNodeType.Arguments) {
            return targetType === WorkflowNodeType.Context;
        }

        if (sourceType === WorkflowNodeType.Context) {
            return targetType === WorkflowNodeType.ForEach
                || targetType === WorkflowNodeType.Entrypoint
                || targetType === WorkflowNodeType.Plugin
                || targetType === WorkflowNodeType.IfStatement
                || targetType === WorkflowNodeType.SwitchStatement;
        }

        if (sourceType === WorkflowNodeType.ForEach) {
            return targetType === WorkflowNodeType.Entrypoint
                || targetType === WorkflowNodeType.Plugin
                || targetType === WorkflowNodeType.IfStatement
                || targetType === WorkflowNodeType.SwitchStatement;
        }

        if (sourceType === WorkflowNodeType.Entrypoint) {
            return targetType === WorkflowNodeType.Exposure
                || targetType === WorkflowNodeType.IfStatement
                || targetType === WorkflowNodeType.SwitchStatement;
        }

        if (sourceType === WorkflowNodeType.Plugin) {
            return targetType === WorkflowNodeType.Plugin
                || targetType === WorkflowNodeType.Entrypoint
                || targetType === WorkflowNodeType.IfStatement
                || targetType === WorkflowNodeType.SwitchStatement;
        }

        if (sourceType === WorkflowNodeType.Exposure) {
            return targetType === WorkflowNodeType.Export;
        }

        if (sourceType === WorkflowNodeType.Export) {
            return false;
        }

        if (sourceType === WorkflowNodeType.IfStatement) {
            return targetType === WorkflowNodeType.Plugin
                || targetType === WorkflowNodeType.Entrypoint
                || targetType === WorkflowNodeType.Exposure
                || targetType === WorkflowNodeType.Export
                || targetType === WorkflowNodeType.SwitchStatement;
        }

        if (sourceType === WorkflowNodeType.SwitchStatement) {
            if (sourceHandle === 'cases') {
                return targetType === WorkflowNodeType.SwitchCase;
            }

            return targetType === WorkflowNodeType.Plugin
                || targetType === WorkflowNodeType.Entrypoint
                || targetType === WorkflowNodeType.Exposure
                || targetType === WorkflowNodeType.Export
                || targetType === WorkflowNodeType.IfStatement
                || targetType === WorkflowNodeType.SwitchStatement;
        }

        if (sourceType === WorkflowNodeType.SwitchCase) {
            return targetType === WorkflowNodeType.Plugin
                || targetType === WorkflowNodeType.Entrypoint
                || targetType === WorkflowNodeType.Exposure
                || targetType === WorkflowNodeType.Export
                || targetType === WorkflowNodeType.IfStatement
                || targetType === WorkflowNodeType.SwitchStatement;
        }

        return false;
    }
}
