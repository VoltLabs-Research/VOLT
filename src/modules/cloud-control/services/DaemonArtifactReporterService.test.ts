import assert from 'node:assert/strict';
import test from 'node:test';
import { createDaemonArtifactReporterService } from './DaemonArtifactReporterService';

class StubVoltCloudConnection {
    public readonly emitted: unknown[] = [];

    getTeamClusterId(): string {
        return 'cluster-1';
    }

    getDaemonPassword(): string {
        return 'daemon-password';
    }

    emitBufferedMessage(message: unknown): void {
        this.emitted.push(message);
    }
}

test('flushPendingArtifacts emits queued artifact metadata immediately', async () => {
    const connection = new StubVoltCloudConnection();
    const service = createDaemonArtifactReporterService(connection as never);

    await service.reportArtifact({
        trajectory: 'trajectory-1',
        storageClusterId: 'storage-1',
        analysis: 'analysis-1',
        plugin: 'plugin-1',
        sourceType: 'plugin-exposure',
        timestep: 1,
        objectName: 'trajectory-1/analysis-1/glb/1/exposure.glb.zst',
        storageBucket: 'volt-models',
        params: {
            exposureId: 'exposure-1'
        },
        displayName: 'Exposure 1',
        status: 'ready',
        metadata: {
            pluginId: 'plugin-1'
        }
    });

    assert.equal(connection.emitted.length, 0);

    service.flushPendingArtifacts();

    assert.equal(connection.emitted.length, 1);
    assert.deepEqual(connection.emitted[0], {
        type: 'trajectory-scene-artifact-upsert-batch',
        teamClusterId: 'cluster-1',
        daemonPassword: 'daemon-password',
        items: [{
            trajectory: 'trajectory-1',
            storageClusterId: 'storage-1',
            analysis: 'analysis-1',
            plugin: 'plugin-1',
            sourceType: 'plugin-exposure',
            timestep: 1,
            objectName: 'trajectory-1/analysis-1/glb/1/exposure.glb.zst',
            storageBucket: 'volt-models',
            params: {
                exposureId: 'exposure-1'
            },
            displayName: 'Exposure 1',
            status: 'ready',
            metadata: {
                pluginId: 'plugin-1'
            }
        }]
    });
});
