import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import TeamClusterExposureRegistryService from './TeamClusterExposureRegistryService';
import {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureSourceKind,
    TeamClusterServiceExposureStatus,
    type TeamClusterServiceExposure
} from '@modules/team-cluster/utilities/teamClusterSocket';

const buildObjectGatewayExposure = (
    teamClusterId: string,
    targetHost: string
): TeamClusterServiceExposure => {
    return {
        id: 'daemon:object-gateway',
        teamClusterId,
        teamId: 'team-1',
        sourceKind: TeamClusterServiceExposureSourceKind.Daemon,
        exposureName: 'object-gateway',
        accessModes: [TeamClusterServiceExposureAccessMode.Http],
        targetHost,
        targetPort: 9080,
        status: TeamClusterServiceExposureStatus.Active,
        labels: {
            'volt.exposure.service': 'object-gateway'
        }
    };
};

test('TeamClusterExposureRegistryService isolates exposures by team cluster id even when exposure ids collide', () => {
    const registry = new TeamClusterExposureRegistryService();
    const storageExposure = buildObjectGatewayExposure('storage-cluster', '10.0.0.10');
    const computeExposure = buildObjectGatewayExposure('compute-cluster', '10.0.0.20');

    registry.replaceTeamClusterExposures(storageExposure.teamClusterId, [storageExposure]);
    registry.replaceTeamClusterExposures(computeExposure.teamClusterId, [computeExposure]);

    assert.equal(
        registry.getTeamClusterExposure(storageExposure.teamClusterId, storageExposure.id)?.targetHost,
        '10.0.0.10'
    );
    assert.equal(
        registry.getTeamClusterExposure(computeExposure.teamClusterId, computeExposure.id)?.targetHost,
        '10.0.0.20'
    );
    assert.deepEqual(
        registry.listTeamClusterExposures(storageExposure.teamClusterId).map((exposure) => exposure.teamClusterId),
        ['storage-cluster']
    );
    assert.deepEqual(
        registry.listTeamClusterExposures(computeExposure.teamClusterId).map((exposure) => exposure.teamClusterId),
        ['compute-cluster']
    );
});
