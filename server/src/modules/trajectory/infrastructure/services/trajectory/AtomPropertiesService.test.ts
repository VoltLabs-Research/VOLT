import assert from 'node:assert/strict';
import test from 'node:test';
import AtomPropertiesService from './AtomPropertiesService';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';

import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

interface DaemonCommandCall {
    clusterId: string;
    command: string;
    payload: Record<string, unknown>;
};

test('buildPluginIndexForAtomIds rebuilds the daemon atom-index payload into a map', async () => {
    const calls: DaemonCommandCall[] = [];
    const daemonClient = {
        command: async (clusterId: string, command: string, payload: Record<string, unknown>) => {
            calls.push({ clusterId, command, payload });

            if (command === 'trajectory.plugin.property-names') {
                return ['charge'];
            }

            if (command === 'trajectory.plugin.atom-index') {
                return {
                    '10': { id: '10', charge: 1.25 },
                    '20': { id: '20', charge: 2.5 }
                };
            }

            return null;
        }
    } as unknown as TeamClusterDaemonClient;

    const analysisRepository = {
        findById: async () => ({
            props: {
                plugin: 'plugin-1',
                trajectory: 'traj-1',
                teamCluster: 'cluster-1'
            }
        })
    } as unknown as IAnalysisRepository;

    const pluginRepository = {
        findById: async () => ({
            props: {
                workflow: {
                    props: {
                        nodes: [
                            {
                                id: 'exposure-1',
                                type: WorkflowNodeType.Exposure,
                                data: {
                                    exposure: {
                                        name: 'Exposure 1'
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        })
    } as unknown as IPluginRepository;

    const service = new AtomPropertiesService(daemonClient, analysisRepository, pluginRepository);

    const result = await service.buildPluginIndexForAtomIds(
        'traj-1',
        'analysis-1',
        'exposure-1',
        '42',
        new Set([10, 20])
    );

    assert.ok(result instanceof Map);
    assert.deepEqual(Array.from(result.entries()), [
        [10, { id: '10', charge: 1.25 }],
        [20, { id: '20', charge: 2.5 }]
    ]);
    assert.deepEqual(calls, [
        {
            clusterId: 'cluster-1',
            command: 'trajectory.plugin.property-names',
            payload: {
                trajectoryId: 'traj-1',
                analysisId: 'analysis-1',
                exposureId: 'exposure-1'
            }
        },
        {
            clusterId: 'cluster-1',
            command: 'trajectory.plugin.atom-index',
            payload: {
                trajectoryId: 'traj-1',
                analysisId: 'analysis-1',
                exposureId: 'exposure-1',
                timestep: 42,
                targetIds: [10, 20]
            }
        }
    ]);
});
