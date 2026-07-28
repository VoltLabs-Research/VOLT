import jsonata from 'jsonata';
import { TTLCache } from '@isaacs/ttlcache';

import { logger } from '@shared/infrastructure/logger';
import type {
    WorkflowExecutionContext,
    WorkflowGraph,
    WorkflowNodeOutput,
    WorkflowNodeType,
    WorkflowValue
} from '@shared/contracts/types/workflow.types';
import { WorkflowNodeType as WorkflowNodeTypeEnum } from '@shared/contracts/types/workflow.types';
import { stringifyUnknown } from '@shared/application/utilities/serialization';
import { isRecord } from '@shared/domain/utilities/is-record';

interface WorkflowValueResolverOptions {
    outputs: Map<string, WorkflowNodeOutput>;
    workflow?: WorkflowGraph;
    context?: WorkflowExecutionContext;
    currentNodeId?: string;
}

const WORKFLOW_REFERENCE_ALIASES: Record<string, WorkflowNodeType[]> = {
    modifier: [WorkflowNodeTypeEnum.Modifier],
    arguments: [WorkflowNodeTypeEnum.Arguments],
    context: [WorkflowNodeTypeEnum.Context],
    foreach: [WorkflowNodeTypeEnum.ForEach],
    'trajectory-window': [WorkflowNodeTypeEnum.TrajectoryWindow],
    entrypoint: [WorkflowNodeTypeEnum.Entrypoint],
    plugin: [WorkflowNodeTypeEnum.Plugin],
    exposure: [WorkflowNodeTypeEnum.Exposure],
    export: [WorkflowNodeTypeEnum.Export],
    if: [WorkflowNodeTypeEnum.IfStatement],
    switch: [WorkflowNodeTypeEnum.SwitchStatement],
    case: [WorkflowNodeTypeEnum.SwitchCase]
};

const COMPILED_EXPRESSION_CACHE_MAX = 512;
const COMPILED_EXPRESSION_CACHE_TTL_MS = 60 * 60 * 1000;
const compiledExpressionCache = new TTLCache<string, ReturnType<typeof jsonata>>({
    max: COMPILED_EXPRESSION_CACHE_MAX,
    ttl: COMPILED_EXPRESSION_CACHE_TTL_MS
});

interface AliasResolutionCache {
    nodeIdsByType: Map<WorkflowNodeType, string[]>;
    topologicalIndexByNodeId: Map<string, number>;
    ancestorIdByNodeType: Map<string, string | null>;
}

const aliasResolutionCacheByGraph = new WeakMap<WorkflowGraph, AliasResolutionCache>();
const nestedWorkflowsScopeByMap = new WeakMap<object, Record<string, unknown>>();

const createOutputsScopeView = (
    outputs: Map<string, WorkflowNodeOutput>
): Record<string, WorkflowNodeOutput> =>
    new Proxy({} as Record<string, WorkflowNodeOutput>, {
        get: (target, property, receiver) =>
            typeof property === 'string' && outputs.has(property)
                ? outputs.get(property)
                : Reflect.get(target, property, receiver),
        has: (target, property) =>
            (typeof property === 'string' && outputs.has(property))
                || Reflect.has(target, property),
        ownKeys: () => [...outputs.keys()],
        getOwnPropertyDescriptor: (_target, property) =>
            typeof property === 'string' && outputs.has(property)
                ? {
                    value: outputs.get(property),
                    enumerable: true,
                    configurable: true,
                    writable: false
                }
                : undefined
    });

export class WorkflowValueResolver {
    constructor(private readonly options: WorkflowValueResolverOptions) {}

    static shouldResolveExpression(value: WorkflowValue): value is string {
        return typeof value === 'string'
            && (value.startsWith('=') || value.includes('{{'));
    }

    resolveReference(ref: string): WorkflowValue {
        const parts = ref
            .trim()
            .replace(/\[(\d+)\]/g, '.$1')
            .split('.')
            .map((part) => part.trim())
            .filter(Boolean);
        const requestedNodeId = parts[0];
        const propertyPath = parts.slice(1);
        const nodeId = this.options.outputs.has(requestedNodeId)
            ? requestedNodeId
            : this.options.workflow
                ? this.resolveAliasNodeId(requestedNodeId) ?? requestedNodeId
                : requestedNodeId;
        const nodeOutput = this.options.outputs.get(nodeId);

        if (!nodeOutput) {
            logger.warn(`Workflow reference not found for node ${nodeId}`);
            return undefined;
        }

        if (propertyPath.length === 0) {
            return nodeOutput;
        }

        let value: WorkflowValue = nodeOutput;

        for (const segment of propertyPath) {
            if (Array.isArray(value)) {
                value = value[Number(segment)];
                continue;
            }

            if (!isRecord(value)) {
                return undefined;
            }

            value = value[segment] as WorkflowValue;
        }

        return value;
    }

    resolveTemplate(template: string): string {
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref: string) => {
            const value = this.resolveReference(ref);
            return value !== undefined
                ? stringifyUnknown(value as Parameters<typeof stringifyUnknown>[0])
                : '';
        });
    }

    resolveExpressionValue(expression: string): Promise<WorkflowValue> {
        return this.resolveExpression(expression);
    }

    async resolveComparableString(expression: string): Promise<string> {
        const resolved = await this.resolveExpression(expression);
        return stringifyUnknown(resolved as Parameters<typeof stringifyUnknown>[0]);
    }

    private resolveAliasNodeId(alias: string): string | null {
        const workflow = this.options.workflow;
        if (!workflow) {
            return null;
        }

        const targetTypes = WORKFLOW_REFERENCE_ALIASES[alias.toLowerCase()];
        if (!targetTypes) {
            return null;
        }

        const cache = this.getAliasResolutionCache(workflow);

        if (this.options.currentNodeId) {
            const currentNode = workflow.getNode(this.options.currentNodeId);
            if (currentNode && targetTypes.includes(currentNode.type)) {
                return currentNode.id;
            }

            for (const targetType of targetTypes) {
                const ancestorKey = `${this.options.currentNodeId}\0${targetType}`;
                let ancestorId = cache.ancestorIdByNodeType.get(ancestorKey);
                if (ancestorId === undefined) {
                    ancestorId = workflow.findAncestorByType(this.options.currentNodeId, targetType)?.id ?? null;
                    cache.ancestorIdByNodeType.set(ancestorKey, ancestorId);
                }
                if (ancestorId !== null) {
                    return ancestorId;
                }
            }
        }

        let bestNodeId: string | null = null;
        let bestIndex = Infinity;
        for (const targetType of targetTypes) {
            const firstNodeId = cache.nodeIdsByType.get(targetType)?.[0];
            if (firstNodeId === undefined) {
                continue;
            }
            const index = cache.topologicalIndexByNodeId.get(firstNodeId) ?? Infinity;
            if (index < bestIndex) {
                bestIndex = index;
                bestNodeId = firstNodeId;
            }
        }

        return bestNodeId;
    }

    private getAliasResolutionCache(workflow: WorkflowGraph): AliasResolutionCache {
        let cache = aliasResolutionCacheByGraph.get(workflow);
        if (cache) {
            return cache;
        }

        const nodeIdsByType = new Map<WorkflowNodeType, string[]>();
        const topologicalIndexByNodeId = new Map<string, number>();

        workflow.topologicalSort().forEach((node, index) => {
            topologicalIndexByNodeId.set(node.id, index);
            const ids = nodeIdsByType.get(node.type);
            if (ids) {
                ids.push(node.id);
            } else {
                nodeIdsByType.set(node.type, [node.id]);
            }
        });

        cache = {
            nodeIdsByType,
            topologicalIndexByNodeId,
            ancestorIdByNodeType: new Map<string, string | null>()
        };
        aliasResolutionCacheByGraph.set(workflow, cache);
        return cache;
    }

    private async resolveExpression(expression: string): Promise<WorkflowValue> {
        if (expression.startsWith('=')) {
            if (!this.options.context) {
                throw new Error('Workflow expression resolution requires an execution context');
            }

            const source = expression.slice(1);
            let compiled = compiledExpressionCache.get(source);
            if (!compiled) {
                compiled = jsonata(source);
                compiledExpressionCache.set(source, compiled);
            }

            return await compiled.evaluate(
                this.buildExpressionScope(this.options.context)
            ) as WorkflowValue;
        }

        return expression.includes('{{')
            ? this.resolveTemplate(expression)
            : expression;
    }

    private buildExpressionScope(
        context: WorkflowExecutionContext
    ): Record<string, unknown> {
        const {
            workflow: _workflow,
            nestedWorkflows,
            outputs,
            ...scope
        } = context;

        let nestedWorkflowsScope = nestedWorkflowsScopeByMap.get(nestedWorkflows);
        if (!nestedWorkflowsScope) {
            nestedWorkflowsScope = Object.fromEntries(nestedWorkflows);
            nestedWorkflowsScopeByMap.set(nestedWorkflows, nestedWorkflowsScope);
        }

        return {
            ...scope,
            currentNodeId: this.options.currentNodeId,
            nestedWorkflows: nestedWorkflowsScope,
            outputs: createOutputsScopeView(outputs)
        };
    }
}
