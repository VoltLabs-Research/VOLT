import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { ContainerDeploymentProgressService } from '@modules/container/services/ContainerDeploymentProgressService';
import type SocketIOEmitter from '@modules/socket/services/SocketIOEmitter';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';

interface RoomEmission{
    room: string;
    event: string;
    data: unknown;
}

interface Fixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
}

const ENTITIES = [TeamCluster, Team, User];

describe('ContainerDeploymentProgressService', () => {
    let dataSource: DataSource;
    let service: ContainerDeploymentProgressService;
    const emissions: RoomEmission[] = [];

    before(async () => {
        dataSource = await createHarness(ENTITIES);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        emissions.length = 0;
        service = new ContainerDeploymentProgressService({
            emitToRoom: (room: string, event: string, data: unknown) => {
                emissions.push({
                    room,
                    event,
                    data
                });
            }
        } as unknown as SocketIOEmitter);
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const cluster = await TeamCluster.create({
            name: 'cluster',
            team: team.id,
            createdBy: owner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();

        return {
            team,
            owner,
            cluster
        };
    };

    it('resolves the team of the cluster and broadcasts the progress to its room', async () => {
        const fixture = await createFixture();

        await service.emitToTeam({
            operationId: 'op-1',
            teamClusterId: fixture.cluster.id,
            stage: 'pulling',
            step: 'download',
            image: 'nginx:latest',
            containerName: 'app',
            timestamp: '2024-01-01T00:00:00.000Z'
        });

        assert.deepEqual(emissions, [{
            room: `team:${fixture.team.id}`,
            event: 'container.deploy.progress',
            data: {
                operationId: 'op-1',
                teamClusterId: fixture.cluster.id,
                teamId: fixture.team.id,
                stage: 'pulling',
                step: 'download',
                image: 'nginx:latest',
                containerName: 'app',
                timestamp: '2024-01-01T00:00:00.000Z'
            }
        }]);
    });

    it('stays silent when the cluster no longer exists', async () => {
        await createFixture();

        await service.emitToTeam({
            operationId: 'op-1',
            teamClusterId: 'a'.repeat(24),
            stage: 'pulling',
            timestamp: '2024-01-01T00:00:00.000Z'
        });

        assert.deepEqual(emissions, []);
    });

    it('stays silent once the cluster row has been deleted', async () => {
        const fixture = await createFixture();
        await TeamCluster.delete({ id: fixture.cluster.id });

        await service.emitToTeam({
            operationId: 'op-1',
            teamClusterId: fixture.cluster.id,
            stage: 'pulling',
            timestamp: '2024-01-01T00:00:00.000Z'
        });

        assert.deepEqual(emissions, []);
    });
});
