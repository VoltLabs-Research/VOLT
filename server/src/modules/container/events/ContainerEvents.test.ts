import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import ContainerEvents from '@modules/container/events/ContainerEvents';
import ContainerService from '@modules/container/services/ContainerService';
import type { ContainerServiceDependencies } from '@modules/container/services/ContainerService';
import Container from '@modules/container/models/Container';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface Fixture{
    team: Team;
    otherTeam: Team;
    owner: User;
    cluster: TeamCluster;
}

const ENTITIES = [Container, TeamCluster, CatalogFolder, Team, User];

describe('ContainerEvents', () => {
    let dataSource: DataSource;
    let events: ContainerEvents;
    const published: EmittedEvent[] = [];
    const removedFromRuntime: string[] = [];
    let removeContainerFailure: string | null;

    const buildDependencies = (): ContainerServiceDependencies => ({
        runtime: {
            createContainer: async () => {
                throw new Error('unused');
            },
            getContainer: async () => {
                throw new Error('unused');
            },
            startContainer: async () => {
                throw new Error('unused');
            },
            stopContainer: async () => {
                throw new Error('unused');
            },
            restartContainer: async () => {
                throw new Error('unused');
            },
            removeContainer: async (_teamClusterId, containerId) => {
                if(removeContainerFailure === containerId){
                    throw new Error('daemon unreachable');
                }
                removedFromRuntime.push(containerId);
            },
            listContainers: async () => [],
            getFiles: async () => [],
            readFile: async () => '',
            getProcesses: async () => [],
            getStats: async () => {
                throw new Error('unused');
            }
        },
        portAllocator: {
            reservePortMappings: async () => ({
                ports: [],
                reservedPublicPorts: []
            }),
            commitReservations: () => {},
            releaseReservations: () => {}
        },
        relay: {
            ensureContainerRelays: async () => {},
            syncContainerRelays: async () => {},
            stopContainerRelays: async () => {},
            stopPublicPortRelays: async () => {},
            createAccessUrl: async () => ({
                url: 'http://relay.test',
                expiresAt: '2024-01-01T00:00:00.000Z'
            })
        },
        systemMetrics: { getLatestByClusterId: async () => null },
        clusterSelection: {
            resolveConnectedClusterId: async () => '',
            resolveComputeClusterId: async () => '',
            resolveStorageClusterId: async () => ''
        },
        eventBus: {
            emit: async (name, payload) => {
                published.push({
                    name,
                    payload
                });
            }
        }
    });

    before(async () => {
        dataSource = await createHarness(ENTITIES);
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        removedFromRuntime.length = 0;
        removeContainerFailure = null;
        events = new ContainerEvents(new ContainerService(buildDependencies()));
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
        const otherTeam = await Team.create({
            name: 'Team Two',
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
            otherTeam,
            owner,
            cluster
        };
    };

    const seedContainer = (
        fixture: Fixture,
        overrides: Partial<Container> = {}
    ): Promise<Container> => Container.create({
        name: 'app',
        image: 'nginx',
        containerId: `docker-${Math.random().toString(36).slice(2)}`,
        team: fixture.team.id,
        teamCluster: fixture.cluster.id,
        createdBy: fixture.owner.id,
        internalIp: '172.17.0.2',
        env: [],
        ports: [],
        ...overrides
    }).save();

    describe('deleteTeamContainers', () => {
        it('deletes every container of the team through the service', async () => {
            const fixture = await createFixture();
            const first = await seedContainer(fixture);
            const second = await seedContainer(fixture);

            await events.deleteTeamContainers({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await Container.countBy({ team: fixture.team.id }), 0);
            assert.deepEqual(
                removedFromRuntime.sort(),
                [first.containerId, second.containerId].sort()
            );
        });

        it('keeps the containers of the other teams', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture);
            const survivor = await seedContainer(fixture, { team: fixture.otherTeam.id });

            await events.deleteTeamContainers({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await Container.countBy({ id: survivor.id }), 1);
        });

        it('publishes one deletion event per container', async () => {
            const fixture = await createFixture();
            const first = await seedContainer(fixture);
            const second = await seedContainer(fixture);

            await events.deleteTeamContainers({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(published.map((event) => event.name), ['container.deleted', 'container.deleted']);
            assert.deepEqual(
                published.map((event) => (event.payload as { containerId: string }).containerId).sort(),
                [first.id, second.id].sort()
            );
        });

        it('keeps deleting the remaining containers when one of them fails', async () => {
            const fixture = await createFixture();
            const broken = await seedContainer(fixture);
            const healthy = await seedContainer(fixture);
            removeContainerFailure = broken.containerId;

            await events.deleteTeamContainers({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await Container.countBy({ id: broken.id }), 1);
            assert.equal(await Container.countBy({ id: healthy.id }), 0);
        });

        it('resolves when the team has no container', async () => {
            const fixture = await createFixture();

            await events.deleteTeamContainers({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(published, []);
        });

        it('tolerates an event without a user id', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await events.deleteTeamContainers({ teamId: fixture.team.id });

            assert.equal(await Container.countBy({ id: container.id }), 0);
            assert.equal((published[0].payload as { userId: string }).userId, '');
        });
    });
});
