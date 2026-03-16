import 'reflect-metadata';

import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { ContextSource } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ContextNode';
import { EntrypointNodeType } from '@modules/plugin/domain/entities/plugin/workflow/nodes/EntrypointNode';
import { WorkflowValidationMode } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import { PluginDependencyResolverService } from '@modules/plugin/infrastructure/services/plugin/PluginDependencyResolverService';
import { WorkflowValidatorService } from '@modules/plugin/infrastructure/services/plugin/WorkflowValidatorService';
import assert from 'node:assert/strict';
import test from 'node:test';

import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import type { WorkflowNode } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import type { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';

interface WorkflowEdgeLike {
    id: string;
    source: string;
    target: string;
};

interface BuildWorkflowOptions {
    pluginNodeParentType?: WorkflowNodeType;
    referencedPluginId?: string;
    pluginNodeChildType?: WorkflowNodeType;
};

const createModifierNode = (): WorkflowNode => ({
    id: 'modifier-1',
    type: WorkflowNodeType.Modifier,
    position: { x: 0, y: 0 },
    data: {
        modifier: {
            name: 'Root Plugin'
        }
    }
});

const createArgumentsNode = (): WorkflowNode => ({
    id: 'arguments-1',
    type: WorkflowNodeType.Arguments,
    position: { x: 0, y: 0 },
    data: {
        arguments: {
            arguments: []
        }
    }
});

const createContextNode = (): WorkflowNode => ({
    id: 'context-1',
    type: WorkflowNodeType.Context,
    position: { x: 0, y: 0 },
    data: {
        context: {
            source: ContextSource.TrajectoryDumps
        }
    }
});

const createForEachNode = (): WorkflowNode => ({
    id: 'foreach-1',
    type: WorkflowNodeType.ForEach,
    position: { x: 0, y: 0 },
    data: {
        forEach: {
            iterableSource: '{{ context.trajectory_dumps }}'
        }
    }
});

const createParentNode = (pluginNodeParentType: WorkflowNodeType): WorkflowNode => {
    if (pluginNodeParentType === WorkflowNodeType.Entrypoint) {
        return {
            id: 'parent-1',
            type: WorkflowNodeType.Entrypoint,
            position: { x: 0, y: 0 },
            data: {
                entrypoint: {
                    binary: 'runner',
                    type: EntrypointNodeType.Executable,
                    binaryObjectPath: 'plugin-binaries/root/runner',
                    arguments: '{{ forEach.currentValue.path }} {{ forEach.outputPath }}'
                }
            }
        };
    }

    if (pluginNodeParentType === WorkflowNodeType.Context) {
        return {
            id: 'parent-1',
            type: WorkflowNodeType.Context,
            position: { x: 0, y: 0 },
            data: {
                context: {
                    source: ContextSource.TrajectoryDumps
                }
            }
        };
    }

    return {
        id: 'parent-1',
        type: WorkflowNodeType.IfStatement,
        position: { x: 0, y: 0 },
        data: {
            ifStatement: {
                conditions: []
            }
        }
    };
};

const createPluginNode = (referencedPluginId: string): WorkflowNode => ({
    id: 'plugin-node-1',
    type: WorkflowNodeType.Plugin,
    position: { x: 0, y: 0 },
    data: {
        pluginNode: {
            pluginId: referencedPluginId,
            config: {}
        }
    }
});

const createExposureNode = (): WorkflowNode => ({
    id: 'exposure-1',
    type: WorkflowNodeType.Exposure,
    position: { x: 0, y: 0 },
    data: {
        exposure: {
            name: 'Nested Result',
            results: 'nested.msgpack'
        }
    }
});

const buildWorkflow = ({
    pluginNodeParentType = WorkflowNodeType.Entrypoint,
    referencedPluginId = 'published-plugin',
    pluginNodeChildType
}: BuildWorkflowOptions = {}): WorkflowProps => {
    const planningNode = pluginNodeParentType === WorkflowNodeType.Entrypoint
        ? createForEachNode()
        : null;
    const parentNode = createParentNode(pluginNodeParentType);
    const pluginNode = createPluginNode(referencedPluginId);
    const pluginChildNode = pluginNodeChildType === WorkflowNodeType.Exposure
        ? createExposureNode()
        : null;

    const nodes: WorkflowNode[] = [
        createModifierNode(),
        createArgumentsNode(),
        createContextNode(),
        ...(planningNode ? [planningNode] : []),
        parentNode,
        pluginNode,
        ...(pluginChildNode ? [pluginChildNode] : [])
    ];

    const edges: WorkflowEdgeLike[] = [
        { id: 'e-1', source: 'modifier-1', target: 'arguments-1' },
        { id: 'e-2', source: 'arguments-1', target: 'context-1' },
        ...(planningNode
            ? [
                { id: 'e-3', source: 'context-1', target: 'foreach-1' },
                { id: 'e-4', source: 'foreach-1', target: 'parent-1' }
            ]
            : [{ id: 'e-3', source: 'context-1', target: 'parent-1' }]),
        { id: 'e-5', source: 'parent-1', target: 'plugin-node-1' },
        ...(pluginChildNode ? [{ id: 'e-6', source: 'plugin-node-1', target: pluginChildNode.id }] : [])
    ];

    return {
        nodes,
        edges
    };
};

const buildPlugin = (id: string, workflow: WorkflowProps, status: PluginStatus = PluginStatus.Published): Plugin => {
    return new Plugin(id, {
        team: 'team-1',
        workflow: new Workflow(id, workflow),
        status,
        createdAt: new Date(),
        updatedAt: new Date()
    });
};

const createRepository = (plugins: Plugin[]): IPluginRepository => {
    return {
        findByIds: async (ids: string[]) => plugins.filter((plugin) => ids.includes(plugin.id)),
        findById: async () => null,
        findOne: async () => null,
        findAll: async () => ({ data: [], total: 0, page: 1, totalPages: 0, limit: 100 }),
        export: async () => [],
        create: async () => { throw new Error('not implemented'); },
        updateById: async () => null,
        updateMany: async () => 0,
        insertMany: async () => undefined,
        deleteById: async () => false,
        deleteMany: async () => 0,
        count: async () => 0,
        countGroupedBy: async () => new Map(),
        exists: async () => false
    };
};

test('WorkflowValidatorService rejects unpublished plugin references', async () => {
    const dependencyResolver = new PluginDependencyResolverService(createRepository([
        buildPlugin('draft-plugin', buildWorkflow(), PluginStatus.Draft)
    ]));
    const service = new WorkflowValidatorService(dependencyResolver);

    const result = await service.validate(buildWorkflow({ referencedPluginId: 'draft-plugin' }), 'root-plugin', WorkflowValidationMode.Strict);

    assert.equal(result.isValid, false);
    assert.ok(result.errors?.some((error) => error.includes('unpublished plugin draft-plugin')));
});

test('WorkflowValidatorService rejects self-reference', async () => {
    const dependencyResolver = new PluginDependencyResolverService(createRepository([]));
    const service = new WorkflowValidatorService(dependencyResolver);

    const result = await service.validate(buildWorkflow({ referencedPluginId: 'root-plugin' }), 'root-plugin', WorkflowValidationMode.Strict);

    assert.equal(result.isValid, false);
    assert.ok(result.errors?.some((error) => error.includes('cannot reference the current plugin')));
});

test('WorkflowValidatorService rejects dependency cycles', async () => {
    const rootWorkflow = buildWorkflow({ referencedPluginId: 'child-plugin' });
    const childWorkflow = buildWorkflow({ referencedPluginId: 'grandchild-plugin' });
    const grandchildWorkflow = buildWorkflow({ referencedPluginId: 'child-plugin' });
    const dependencyResolver = new PluginDependencyResolverService(createRepository([
        buildPlugin('child-plugin', childWorkflow),
        buildPlugin('grandchild-plugin', grandchildWorkflow)
    ]));
    const service = new WorkflowValidatorService(dependencyResolver);

    const result = await service.validate(rootWorkflow, 'root-plugin', WorkflowValidationMode.Strict);

    assert.equal(result.isValid, false);
    assert.ok(result.errors?.some((error) => error.includes('Plugin dependency cycle detected')));
});

test('WorkflowValidatorService rejects plugin-node in planning topology', async () => {
    const dependencyResolver = new PluginDependencyResolverService(createRepository([
        buildPlugin('published-plugin', buildWorkflow())
    ]));
    const service = new WorkflowValidatorService(dependencyResolver);

    const result = await service.validate(buildWorkflow({ pluginNodeParentType: WorkflowNodeType.Context }), 'root-plugin', WorkflowValidationMode.Strict);

    assert.equal(result.isValid, false);
    assert.ok(result.errors?.some((error) => error.includes('only supported after the top-level planning segment')));
});

test('WorkflowValidatorService rejects downstream non-plugin children from plugin-node', async () => {
    const dependencyResolver = new PluginDependencyResolverService(createRepository([
        buildPlugin('published-plugin', buildWorkflow())
    ]));
    const service = new WorkflowValidatorService(dependencyResolver);

    const result = await service.validate(buildWorkflow({
        referencedPluginId: 'published-plugin',
        pluginNodeChildType: WorkflowNodeType.Exposure
    }), 'root-plugin', WorkflowValidationMode.Strict);

    assert.equal(result.isValid, false);
    assert.ok(result.errors?.some((error) => error.includes('may only connect to downstream plugin nodes')));
});
