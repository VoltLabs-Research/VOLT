import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ErrorCodes } from '@core/constants/error-codes';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import Trajectory, { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ExecutePluginUseCase } from './ExecutePluginUseCase';

class StubPluginRepository {
    constructor(private readonly plugin: Plugin) {}

    async findById(): Promise<Plugin> {
        return this.plugin;
    }

    async findByIds(): Promise<Plugin[]> {
        return [];
    }
}

class StubTrajectoryRepository {
    constructor(private readonly trajectory: Trajectory) {}

    async findById(): Promise<Trajectory> {
        return this.trajectory;
    }
}

class StubAnalysisRepository {
    public readonly updates: Array<{ id: string; data: Partial<Analysis['props']> }> = [];

    async create(input: Analysis['props']): Promise<Analysis> {
        return new Analysis('analysis-1', {
            ...input,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    async updateById(id: string, data: Partial<Analysis['props']>): Promise<Analysis | null> {
        this.updates.push({ id, data });
        return null;
    }
}

class StubEventBus {
    public readonly publishedEvents: string[] = [];

    async publish(event: { name: string }): Promise<void> {
        this.publishedEvents.push(event.name);
    }
}

class StubTeamClusterSelectionService {
    async resolveComputeClusterId(): Promise<string> {
        return 'compute-1';
    }
}

class StubWorkflowValidatorService {
    async validate() {
        return {
            isValid: true,
            errors: []
        };
    }
}

class StubPluginDependencyResolverService {
    getArgumentPluginReferenceExecutions(): [] {
        return [];
    }

    async collectTransitivePublishedDependencies() {
        return {
            dependencies: [],
            errors: []
        };
    }
}

class StubStoragePlacementService {
    public readonly ensuredPlacements: Array<{ scopeType: string; scopeId: string }> = [];

    async ensurePlacement(scopeType: string, scopeId: string): Promise<void> {
        this.ensuredPlacements.push({ scopeType, scopeId });
    }
}

class FailingPluginExecutionRouter {
    async route(): Promise<void> {
        throw ApplicationError.conflict(
            ErrorCodes.PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE,
            'Plugin binary is not reachable from compute cluster'
        );
    }
}

const buildWorkflow = () => new Workflow('plugin-1', {
    nodes: [
        {
            id: 'modifier',
            type: WorkflowNodeType.Modifier,
            position: { x: 0, y: 0 },
            data: {
                modifier: {
                    name: 'Example Plugin'
                }
            }
        },
        {
            id: 'for-each',
            type: WorkflowNodeType.ForEach,
            position: { x: 120, y: 0 },
            data: {
                forEach: {
                    iterableSource: 'trajectory.frames'
                }
            }
        },
        {
            id: 'entrypoint',
            type: WorkflowNodeType.Entrypoint,
            position: { x: 240, y: 0 },
            data: {
                entrypoint: {
                    binaryObjectPath: 'plugin-binaries/plugin-1/binary.zip',
                    arguments: '--input {{ context.path }}'
                }
            }
        }
    ],
    edges: [{
        id: 'edge-1',
        source: 'for-each',
        target: 'entrypoint'
    }]
});

test('ExecutePluginUseCase marks the analysis as failed when dispatch aborts after creation', async () => {
    const plugin = new Plugin('plugin-1', {
        team: 'team-1',
        workflow: buildWorkflow(),
        status: PluginStatus.Published,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    const trajectory = new Trajectory('trajectory-1', {
        name: 'Trajectory 1',
        team: 'team-1',
        folder: null,
        storageClusterId: 'storage-1',
        createdBy: 'user-1',
        status: TrajectoryStatus.Completed,
        isPublic: false,
        frames: [{
            timestep: 1,
            natoms: 42,
            simulationCell: '10 0 0 0 10 0 0 0 10'
        }],
        rasterSceneViews: 0,
        stats: {
            totalFiles: 1,
            totalSize: 1
        },
        updatedAt: new Date(),
        createdAt: new Date()
    });
    const analysisRepository = new StubAnalysisRepository();
    const eventBus = new StubEventBus();
    const storagePlacementService = new StubStoragePlacementService();

    const useCase = new ExecutePluginUseCase(
        new StubPluginRepository(plugin) as any,
        eventBus as any,
        analysisRepository as any,
        new StubTeamClusterSelectionService() as any,
        new StubTrajectoryRepository(trajectory) as any,
        new FailingPluginExecutionRouter() as any,
        new StubWorkflowValidatorService() as any,
        new StubPluginDependencyResolverService() as any,
        storagePlacementService as any
    );

    await assert.rejects(
        () => useCase.execute({
            teamId: 'team-1',
            userId: 'user-1',
            pluginId: 'plugin-1',
            trajectoryId: 'trajectory-1',
            teamClusterId: 'compute-1',
            config: {}
        }),
        (error: unknown) => {
            assert.ok(error instanceof ApplicationError);
            assert.equal(error.statusCode, 409);
            assert.equal(error.code, ErrorCodes.PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE);
            return true;
        }
    );

    assert.deepEqual(storagePlacementService.ensuredPlacements, [
        {
            scopeType: 'plugin-binary',
            scopeId: 'plugin-1'
        },
        {
            scopeType: 'analysis',
            scopeId: 'analysis-1'
        }
    ]);
    assert.equal(eventBus.publishedEvents.includes('analysis.created'), true);
    assert.equal(analysisRepository.updates.length, 1);
    assert.equal(analysisRepository.updates[0]?.id, 'analysis-1');
    assert.equal(analysisRepository.updates[0]?.data.status, 'failed');
    assert.ok(analysisRepository.updates[0]?.data.finishedAt instanceof Date);
});
