import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { ContainerPortRelayLifecycleService } from '@modules/container/services/ContainerPortRelayLifecycleService';
import type { ContainerPortProxyRelayService } from '@modules/container/services/ContainerPortProxyRelayService';
import Container from '@modules/container/models/Container';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import type { ContainerPortMapping } from '@shared/contracts/ports/IContainerService';

interface RelayTarget{
    teamId: string;
    containerId: string;
    teamClusterId: string;
    internalIp: string;
    privatePort: number;
    publicPort: number;
}

interface Fixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
}

const ENTITIES = [Container, TeamCluster, CatalogFolder, Team, User];

describe('ContainerPortRelayLifecycleService', () => {
    let dataSource: DataSource;
    let service: ContainerPortRelayLifecycleService;
    const ensuredRelays: RelayTarget[][] = [];
    let stopAllCalls = 0;

    const relayStub = (): ContainerPortProxyRelayService => ({
        ensureContainerRelays: async (relays: RelayTarget[]) => {
            ensuredRelays.push(relays);
        },
        stopAll: async () => {
            stopAllCalls += 1;
        }
    } as unknown as ContainerPortProxyRelayService);

    before(async () => {
        dataSource = await createHarness(ENTITIES);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        ensuredRelays.length = 0;
        stopAllCalls = 0;
        service = new ContainerPortRelayLifecycleService(relayStub());
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

    const seedContainer = (
        fixture: Fixture,
        ports: ContainerPortMapping[],
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
        ports,
        ...overrides
    }).save();

    describe('start', () => {
        it('reopens one relay per public port of every stored container', async () => {
            const fixture = await createFixture();
            const first = await seedContainer(fixture, [
                {
                    private: 8080,
                    public: 24010
                },
                {
                    private: 9090,
                    public: 24011
                }
            ]);
            const second = await seedContainer(fixture, [{
                private: 3000,
                public: 24012
            }], { internalIp: '172.17.0.3' });

            await service.start();

            assert.equal(ensuredRelays.length, 1);
            assert.deepEqual(ensuredRelays[0], [
                {
                    teamId: fixture.team.id,
                    containerId: first.id,
                    teamClusterId: fixture.cluster.id,
                    internalIp: '172.17.0.2',
                    privatePort: 8080,
                    publicPort: 24010
                },
                {
                    teamId: fixture.team.id,
                    containerId: first.id,
                    teamClusterId: fixture.cluster.id,
                    internalIp: '172.17.0.2',
                    privatePort: 9090,
                    publicPort: 24011
                },
                {
                    teamId: fixture.team.id,
                    containerId: second.id,
                    teamClusterId: fixture.cluster.id,
                    internalIp: '172.17.0.3',
                    privatePort: 3000,
                    publicPort: 24012
                }
            ]);
        });

        it('skips the port mappings without a public port', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, [
                { private: 8080 },
                {
                    private: 9090,
                    public: 24011
                }
            ]);

            await service.start();

            assert.deepEqual(ensuredRelays[0].map((relay) => relay.publicPort), [24011]);
        });

        it('skips a public port that is not a positive number', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, [{
                private: 8080,
                public: 0
            }]);

            await service.start();

            assert.deepEqual(ensuredRelays[0], []);
        });

        it('skips a container that has no ip address yet', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, [{
                private: 8080,
                public: 24010
            }], { internalIp: null });

            await service.start();

            assert.deepEqual(ensuredRelays[0], []);
        });

        it('skips a container that is not attached to a team', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, [{
                private: 8080,
                public: 24010
            }], { team: null });

            await service.start();

            assert.deepEqual(ensuredRelays[0], []);
        });

        it('opens no relay when no container is stored', async () => {
            await createFixture();

            await service.start();

            assert.deepEqual(ensuredRelays, [[]]);
        });
    });

    describe('stop', () => {
        it('shuts every relay down', async () => {
            await createFixture();

            await service.stop();

            assert.equal(stopAllCalls, 1);
        });
    });
});
