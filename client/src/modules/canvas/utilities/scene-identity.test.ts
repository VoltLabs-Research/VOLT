import assert from 'node:assert/strict';
import test from 'node:test';
import { isSameScene, toSceneObjectFromArtifact } from './scene-identity';

import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts';

const compositeParticleFilterArtifact: SceneArtifact = {
    _id: 'artifact-1',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
    trajectory: 'trajectory-1',
    analysis: { _id: 'analysis-1' },
    teamCluster: 'cluster-1',
    sourceType: 'particle-filter',
    timestep: 0,
    objectName: 'trajectory-traj-1/analysis-analysis-1/glb/0/particle-filter/composite/or-fixture-highlight.glb',
    storageBucket: 'models',
    params: {
        combinator: 'OR',
        conditions: [
            {
                property: 'type',
                operator: '==',
                value: 1
            },
            {
                property: 'charge',
                operator: '>',
                value: 0,
                exposureId: 'exposure-1'
            }
        ],
        action: 'highlight'
    },
    displayName: 'PF fixture',
    status: 'ready'
};

test('isSameScene keeps single-condition legacy particle filters compatible with composite scenes', () => {
    const legacyScene = {
        sceneType: 'particle-filter',
        source: 'particle-filter',
        analysisId: 'analysis-1',
        exposureId: 'exposure-1',
        property: 'charge',
        operator: '>',
        value: 0,
        action: 'delete'
    };
    const compositeScene = {
        sceneType: 'particle-filter',
        source: 'particle-filter',
        analysisId: 'analysis-1',
        combinator: 'AND',
        conditions: [{
            exposureId: 'exposure-1',
            property: 'charge',
            operator: '>',
            value: 0
        }],
        action: 'delete'
    };

    assert.equal(isSameScene(legacyScene, compositeScene), true);
});

test('toSceneObjectFromArtifact restores composite particle filter params with legacy fallbacks', () => {
    assert.deepEqual(toSceneObjectFromArtifact(compositeParticleFilterArtifact), {
        sceneType: 'particle-filter',
        source: 'particle-filter',
        analysisId: 'analysis-1',
        combinator: 'OR',
        conditions: [
            {
                property: 'type',
                operator: '==',
                value: 1
            },
            {
                property: 'charge',
                operator: '>',
                value: 0,
                exposureId: 'exposure-1'
            }
        ],
        exposureId: undefined,
        property: 'type',
        operator: '==',
        value: 1,
        action: 'highlight'
    });
});
