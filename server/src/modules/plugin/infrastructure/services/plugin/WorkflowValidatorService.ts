import Workflow, { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { WorkflowEdge } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowEdge';
import { WorkflowNode, WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { EntrypointNodeType } from '@modules/plugin/domain/entities/plugin/workflow/nodes/EntrypointNode';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    IWorkflowValidatorService,
    WorkflowValidationMode,
    WorkflowValidationResult
} from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import { PluginDependencyResolverService } from '@modules/plugin/infrastructure/services/plugin/PluginDependencyResolverService';
import Plugin from '@modules/plugin/domain/entities/plugin/Plugin';

import { inject, injectable } from 'tsyringe';

@injectable()
export class WorkflowValidatorService implements IWorkflowValidatorService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginDependencyResolverService)
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

        if (!workflow.edges || !Array.isArray(workflow.edges)) {
            errors.push('Workflow must have edges array');
        }

        if (Array.isArray(workflow.edges)) {
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
            : EntrypointNodeType.Executable;

        if (!binaryObjectPath) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} requires an uploaded binary`);
        }

        if (!argumentsTemplate) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} must define execution arguments`);
        }

        if (entrypointType === EntrypointNodeType.PythonScript) {
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

    private validatePluginNodeTopology(workflow: WorkflowProps, errors: string[]): void {
        const parentMap = new Map<string, WorkflowNode[]>();
        const childMap = new Map<string, WorkflowNode[]>();
        const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));

        for (const edge of workflow.edges) {
            const parentNode = nodeMap.get(edge.source);
            const childNode = nodeMap.get(edge.target);
            if (!parentNode) {
                continue;
            }

            const parents = parentMap.get(edge.target) ?? [];
            parents.push(parentNode);
            parentMap.set(edge.target, parents);

            if (childNode) {
                const children = childMap.get(edge.source) ?? [];
                children.push(childNode);
                childMap.set(edge.source, children);
            }
        }

        for (const node of workflow.nodes) {
            if (node.type !== WorkflowNodeType.Plugin) {
                continue;
            }

            const pluginId = node.data.pluginNode?.pluginId?.trim() ?? '';
            if (!pluginId) {
                errors.push(`Plugin node ${node.id} must reference a published plugin`);
            }

            const parents = parentMap.get(node.id) ?? [];
            const invalidParents = parents.filter((parent) => !this.isAllowedRuntimeParent(parent.type));
            if (parents.length !== 1 || invalidParents.length > 0) {
                errors.push(`Plugin node ${node.id} must be connected directly after a forEach node or another plugin node`);
            }

            if (!this.hasAncestorOfType(node.id, workflow, new Set([WorkflowNodeType.ForEach]))) {
                errors.push(`Plugin node ${node.id} must run after the top-level planning segment`);
            }

            if (this.hasAncestorOfType(node.id, workflow, new Set([WorkflowNodeType.Entrypoint]))) {
                errors.push(`Plugin node ${node.id} must run before the top-level entrypoint`);
            }

            const children = childMap.get(node.id) ?? [];
            const invalidChildren = children.filter((child) => !this.isAllowedRuntimeChild(child.type));
            if (children.length !== 1 || invalidChildren.length > 0) {
                errors.push(`Plugin node ${node.id} must connect only to a downstream plugin node or the top-level entrypoint`);
            }

            if (!this.hasDescendantOfType(node.id, workflow, new Set([WorkflowNodeType.Entrypoint]))) {
                errors.push(`Plugin node ${node.id} must eventually connect to the top-level entrypoint`);
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
        const parentNodes = workflow.edges
            .filter((edge) => edge.target === entrypointNode.id)
            .map((edge) => workflow.nodes.find((node) => node.id === edge.source))
            .filter((node): node is WorkflowNode => Boolean(node));
        const invalidParents = parentNodes.filter((node) => !this.isAllowedRuntimeParent(node.type));

        if (parentNodes.length !== 1 || invalidParents.length > 0) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} must be connected to exactly one runtime chain`);
        }

        if (!this.hasAncestorOfType(entrypointNode.id, workflow, new Set([WorkflowNodeType.ForEach]))) {
            errors.push(`Top-level entrypoint ${entrypointNode.id} must run after the top-level planning segment`);
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

    private hasDescendantOfType(nodeId: string, workflow: WorkflowProps, allowedTypes: Set<WorkflowNodeType>): boolean {
        const visited = new Set<string>();
        const queue = [nodeId];

        while (queue.length > 0) {
            const currentNodeId = queue.shift() as string;
            if (visited.has(currentNodeId)) {
                continue;
            }

            visited.add(currentNodeId);
            const childEdges = workflow.edges.filter((edge) => edge.source === currentNodeId);
            for (const edge of childEdges) {
                const childNode = workflow.nodes.find((candidate) => candidate.id === edge.target);
                if (!childNode) {
                    continue;
                }

                if (allowedTypes.has(childNode.type)) {
                    return true;
                }

                queue.push(childNode.id);
            }
        }

        return false;
    }

    private isAllowedRuntimeParent(nodeType: WorkflowNodeType): boolean {
        return nodeType === WorkflowNodeType.ForEach
            || nodeType === WorkflowNodeType.Plugin;
    }

    private isAllowedRuntimeChild(nodeType: WorkflowNodeType): boolean {
        return nodeType === WorkflowNodeType.Entrypoint
            || nodeType === WorkflowNodeType.Plugin;
    }
};
