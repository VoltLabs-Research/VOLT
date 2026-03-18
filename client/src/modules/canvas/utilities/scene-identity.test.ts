import assert from 'node:assert/strict';
import test from 'node:test';
import { isSameScene, toSceneObjectFromArtifact } from './scene-identity';

import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts';

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
    const artifact = {
        sourceType: 'particle-filter',
        analysis: { _id: 'analysis-1' },
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
        }
    } as unknown as SceneArtifact;

    assert.deepEqual(toSceneObjectFromArtifact(artifact), {
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
