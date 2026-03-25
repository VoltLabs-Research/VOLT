import assert from 'node:assert/strict';
import test from 'node:test';
import {
    readPluginAnalysisAllAtomsRequest,
    readPluginPropertyNamesRequest
} from './payloadValidation';

test('readPluginPropertyNamesRequest requires an explicit ownerClusterId', () => {
    assert.throws(
        () => readPluginPropertyNamesRequest({
            trajectoryId: 'trajectory-1',
            analysisId: 'analysis-1',
            exposureId: 'exposure-1'
        }),
        /ownerClusterId is required/
    );
});

test('readPluginPropertyNamesRequest keeps the explicit ownerClusterId', () => {
    assert.deepEqual(
        readPluginPropertyNamesRequest({
            trajectoryId: 'trajectory-1',
            analysisId: 'analysis-1',
            exposureId: 'exposure-1',
            timestep: 7,
            ownerClusterId: 'storage-1'
        }),
        {
            trajectoryId: 'trajectory-1',
            analysisId: 'analysis-1',
            exposureId: 'exposure-1',
            timestep: 7,
            ownerClusterId: 'storage-1'
        }
    );
});

test('readPluginAnalysisAllAtomsRequest requires an explicit ownerClusterId', () => {
    assert.throws(
        () => readPluginAnalysisAllAtomsRequest({
            trajectoryId: 'trajectory-1',
            analysisId: 'analysis-1',
            timestep: 2
        }),
        /ownerClusterId is required/
    );
});
