import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import ContainerService from '@modules/container/services/ContainerService';
import type { ContainerServiceDependencies } from '@modules/container/services/ContainerService';
import Container from '@modules/container/models/Container';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import type {
    ContainerPortMapping,
    ContainerStats,
    RuntimeContainerInfo
} from '@shared/contracts/ports/IContainerService';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface RelayTarget{
    teamId: string;
    containerId: string;
    teamClusterId: string;
    internalIp: string;
    privatePort: number;
    publicPort: number;
}

interface RuntimeCall{
    action: string;
    teamClusterId: string;
    containerId?: string;
}

interface Fixture{
    team: Team;
    otherTeam: Team;
    owner: User;
    cluster: TeamCluster;
}

const ENTITIES = [Container, TeamCluster, CatalogFolder, Team, User];

const onTheWire = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T;

const isApplicationError = (code: string, statusCode: number) => (error: unknown): boolean => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
};

const runtimeInfo = (id: string, internalIp: string | null, status = 'running'): RuntimeContainerInfo => ({
    Id: id,
    State: { Status: status },
    NetworkSettings: internalIp === null ? {} : { IPAddress: internalIp }
} as unknown as RuntimeContainerInfo);

describe('ContainerService', () => {
    let dataSource: DataSource;
    let service: ContainerService;
    const published: EmittedEvent[] = [];
    const ensuredRelays: RelayTarget[][] = [];
    const syncedRelays: Array<{ containerId: string; relays: RelayTarget[] }> = [];
    const stoppedContainerRelays: string[] = [];
    const stoppedPublicPortRelays: number[][] = [];
    const runtimeCalls: RuntimeCall[] = [];
    const committedReservations: number[][] = [];
    const releasedReservations: number[][] = [];

    let nextInternalIp: string | null;
    let nextRuntimeStatus: string;
    let runtimeListing: Array<{ Id: string; State?: string }>;
    let clusterMetrics: SystemMetrics | null;
    let createContainerFailure: Error | null;
    let reservationCounter: number;
    let resolvedClusterId: string;

    const buildDependencies = (): ContainerServiceDependencies => ({
        runtime: {
            createContainer: async (teamClusterId) => {
                runtimeCalls.push({
                    action: 'create',
                    teamClusterId
                });
                if(createContainerFailure) throw createContainerFailure;
                return runtimeInfo('docker-created', nextInternalIp, nextRuntimeStatus);
            },
            getContainer: async (teamClusterId, containerId) => {
                runtimeCalls.push({
                    action: 'get',
                    teamClusterId,
                    containerId
                });
                return runtimeInfo(containerId, nextInternalIp, nextRuntimeStatus);
            },
            startContainer: async (teamClusterId, containerId) => {
                runtimeCalls.push({
                    action: 'start',
                    teamClusterId,
                    containerId
                });
                return runtimeInfo(containerId, nextInternalIp, 'running');
            },
            stopContainer: async (teamClusterId, containerId) => {
                runtimeCalls.push({
                    action: 'stop',
                    teamClusterId,
                    containerId
                });
                return runtimeInfo(containerId, nextInternalIp, 'exited');
            },
            restartContainer: async (teamClusterId, containerId) => {
                runtimeCalls.push({
                    action: 'restart',
                    teamClusterId,
                    containerId
                });
                return runtimeInfo(containerId, nextInternalIp, 'running');
            },
            removeContainer: async (teamClusterId, containerId) => {
                runtimeCalls.push({
                    action: 'remove',
                    teamClusterId,
                    containerId
                });
            },
            listContainers: async (teamClusterId) => {
                runtimeCalls.push({
                    action: 'list',
                    teamClusterId
                });
                return runtimeListing;
            },
            getFiles: async (teamClusterId, containerId, path) => {
                runtimeCalls.push({
                    action: `files:${path}`,
                    teamClusterId,
                    containerId
                });
                return [{
                    name: 'app.js',
                    isDirectory: false,
                    size: '12',
                    permissions: '-rw-r--r--',
                    date: '2024-01-01'
                }];
            },
            readFile: async (teamClusterId, containerId, path) => {
                runtimeCalls.push({
                    action: `read:${path}`,
                    teamClusterId,
                    containerId
                });
                return 'file contents';
            },
            getProcesses: async (teamClusterId, containerId) => {
                runtimeCalls.push({
                    action: 'processes',
                    teamClusterId,
                    containerId
                });
                return [{ pid: '1' }];
            },
            getStats: async (teamClusterId, containerId) => {
                runtimeCalls.push({
                    action: 'stats',
                    teamClusterId,
                    containerId
                });
                return {
                    memory_stats: {
                        usage: 128 * 1024 * 1024,
                        limit: 512 * 1024 * 1024
                    },
                    networks: {
                        eth0: {
                            rx_bytes: 100,
                            tx_bytes: 20
                        },
                        eth1: {
                            rx_bytes: 5,
                            tx_bytes: 1
                        }
                    }
                } as unknown as ContainerStats;
            }
        },
        portAllocator: {
            reservePortMappings: async (ports) => {
                const resolved = (ports ?? []).map((port) => ({
                    private: port.private,
                    public: port.public ?? (25000 + (reservationCounter += 1))
                }));
                return {
                    ports: resolved,
                    reservedPublicPorts: resolved.map((port) => port.public as number)
                };
            },
            commitReservations: (publicPorts) => {
                committedReservations.push([...publicPorts]);
            },
            releaseReservations: (publicPorts) => {
                releasedReservations.push([...publicPorts]);
            }
        },
        relay: {
            ensureContainerRelays: async (relays) => {
                ensuredRelays.push(relays as RelayTarget[]);
            },
            syncContainerRelays: async (containerId, relays) => {
                syncedRelays.push({
                    containerId,
                    relays: relays as RelayTarget[]
                });
            },
            stopContainerRelays: async (containerId) => {
                stoppedContainerRelays.push(containerId);
            },
            stopPublicPortRelays: async (publicPorts) => {
                stoppedPublicPortRelays.push([...publicPorts]);
            },
            createAccessUrl: async (input) => ({
                url: `http://relay.test/${input.containerId}/${input.privatePort}`,
                expiresAt: '2024-01-01T00:00:00.000Z'
            })
        },
        systemMetrics: { getLatestByClusterId: async () => clusterMetrics },
        clusterSelection: {
            resolveConnectedClusterId: async (_teamId, requested) => requested ?? resolvedClusterId,
            resolveComputeClusterId: async (_teamId, requested) => requested ?? resolvedClusterId,
            resolveStorageClusterId: async (_teamId, requested) => requested ?? resolvedClusterId
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
        ensuredRelays.length = 0;
        syncedRelays.length = 0;
        stoppedContainerRelays.length = 0;
        stoppedPublicPortRelays.length = 0;
        runtimeCalls.length = 0;
        committedReservations.length = 0;
        releasedReservations.length = 0;
        nextInternalIp = '172.17.0.2';
        nextRuntimeStatus = 'running';
        runtimeListing = [];
        clusterMetrics = null;
        createContainerFailure = null;
        reservationCounter = 0;
        resolvedClusterId = '';
        service = new ContainerService(buildDependencies());
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
        resolvedClusterId = cluster.id;

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
        status: 'running',
        env: [],
        ports: [],
        folder: null,
        ...overrides
    }).save();

    const seedFolder = (
        fixture: Fixture,
        title: string,
        parent: string | null = null,
        kind = CatalogFolderKind.Container
    ): Promise<CatalogFolder> => CatalogFolder.create({
        team: fixture.team.id,
        createdBy: fixture.owner.id,
        title,
        parent,
        kind
    }).save();

    const metricsWith = (cores: number, totalGigabytes: number): SystemMetrics => ({
        cpu: { cores },
        memory: { total: totalGigabytes }
    } as unknown as SystemMetrics);

    const detachCluster = async (containerId: string): Promise<void> => {
        await dataSource.query('PRAGMA foreign_keys = OFF');
        await dataSource.query('UPDATE "containers" SET "teamCluster" = ? WHERE "id" = ?', ['', containerId]);
        await dataSource.query('PRAGMA foreign_keys = ON');
    };

    describe('create', () => {
        it('persists the container with the runtime identity and the resolved cluster', async () => {
            const fixture = await createFixture();

            const { container } = await service.create(fixture.team.id, fixture.owner.id, {
                name: 'My App',
                image: 'nginx:latest',
                teamClusterId: fixture.cluster.id
            });

            const stored = await Container.findOneBy({ id: container.id });
            assert.equal(stored?.name, 'My App');
            assert.equal(stored?.image, 'nginx:latest');
            assert.equal(stored?.containerId, 'docker-created');
            assert.equal(stored?.teamCluster, fixture.cluster.id);
            assert.equal(stored?.team, fixture.team.id);
            assert.equal(stored?.createdBy, fixture.owner.id);
            assert.equal(stored?.internalIp, '172.17.0.2');
            assert.equal(stored?.status, 'running');
        });

        it('defaults the resource limits to 512 megabytes and one cpu', async () => {
            const fixture = await createFixture();

            const { container } = await service.create(fixture.team.id, fixture.owner.id, {
                name: 'app',
                image: 'nginx'
            });

            const stored = await Container.findOneBy({ id: container.id });
            assert.equal(stored?.memory, 512);
            assert.equal(stored?.cpus, 1);
        });

        it('stores the requested environment variables and the assigned ports as json', async () => {
            const fixture = await createFixture();

            const { container } = await service.create(fixture.team.id, fixture.owner.id, {
                name: 'app',
                image: 'nginx',
                env: [{
                    key: 'MODE',
                    value: 'test'
                }],
                ports: [{ private: 3000 }]
            });

            const stored = await Container.findOneBy({ id: container.id });
            assert.deepEqual(stored?.env, [{
                key: 'MODE',
                value: 'test'
            }]);
            assert.deepEqual(stored?.ports, [{
                private: 3000,
                public: 25001
            }]);
        });

        it('opens a relay for every assigned public port and commits the reservations', async () => {
            const fixture = await createFixture();

            const { container } = await service.create(fixture.team.id, fixture.owner.id, {
                name: 'app',
                image: 'nginx',
                ports: [{ private: 3000 }]
            });

            assert.deepEqual(ensuredRelays, [[{
                teamId: fixture.team.id,
                containerId: container.id,
                teamClusterId: fixture.cluster.id,
                internalIp: '172.17.0.2',
                privatePort: 3000,
                publicPort: 25001
            }]]);
            assert.deepEqual(committedReservations, [[25001]]);
        });

        it('publishes the creation event', async () => {
            const fixture = await createFixture();

            const { container } = await service.create(fixture.team.id, fixture.owner.id, {
                name: 'app',
                image: 'nginx'
            });

            assert.deepEqual(published, [{
                name: 'container.created',
                payload: {
                    containerId: container.id,
                    teamId: fixture.team.id,
                    name: 'app',
                    userId: fixture.owner.id
                }
            }]);
        });

        it('places the container inside the requested folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'stack');

            const { container } = await service.create(fixture.team.id, fixture.owner.id, {
                name: 'app',
                image: 'nginx',
                folderId: folder.id
            });

            assert.equal((await Container.findOneBy({ id: container.id }))?.folder, folder.id);
        });

        it('rejects a folder that belongs to another catalog kind', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'stack', null, CatalogFolderKind.Whiteboard);

            await assert.rejects(
                () => service.create(fixture.team.id, fixture.owner.id, {
                    name: 'app',
                    image: 'nginx',
                    folderId: folder.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
            assert.equal(await Container.count(), 0);
        });

        it('rejects a folder that belongs to another team', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'stack');

            await assert.rejects(
                () => service.create(fixture.otherTeam.id, fixture.owner.id, {
                    name: 'app',
                    image: 'nginx',
                    folderId: folder.id
                }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('rejects a cpu request above the cluster capacity', async () => {
            const fixture = await createFixture();
            clusterMetrics = metricsWith(2, 16);

            await assert.rejects(
                () => service.create(fixture.team.id, fixture.owner.id, {
                    name: 'app',
                    image: 'nginx',
                    cpus: 8
                }),
                isApplicationError('Validation::InvalidInput', 400)
            );
            assert.equal(await Container.count(), 0);
        });

        it('rejects a memory request above the cluster capacity', async () => {
            const fixture = await createFixture();
            clusterMetrics = metricsWith(8, 1);

            await assert.rejects(
                () => service.create(fixture.team.id, fixture.owner.id, {
                    name: 'app',
                    image: 'nginx',
                    memory: 4096
                }),
                isApplicationError('Validation::InvalidInput', 400)
            );
        });

        it('accepts a request that fits the cluster capacity', async () => {
            const fixture = await createFixture();
            clusterMetrics = metricsWith(8, 16);

            const { container } = await service.create(fixture.team.id, fixture.owner.id, {
                name: 'app',
                image: 'nginx',
                cpus: 4,
                memory: 2048
            });

            const stored = await Container.findOneBy({ id: container.id });
            assert.equal(stored?.cpus, 4);
            assert.equal(stored?.memory, 2048);
        });

        it('rejects a container whose runtime never exposes an ip address', async () => {
            const fixture = await createFixture();
            nextInternalIp = null;

            await assert.rejects(
                () => service.create(fixture.team.id, fixture.owner.id, {
                    name: 'app',
                    image: 'nginx'
                }),
                isApplicationError('Container::NetworkingUnavailable', 409)
            );
            assert.equal(await Container.count(), 0);
        });

        it('releases the reserved ports when the runtime refuses to create the container', async () => {
            const fixture = await createFixture();
            createContainerFailure = new Error('daemon unreachable');

            await assert.rejects(
                () => service.create(fixture.team.id, fixture.owner.id, {
                    name: 'app',
                    image: 'nginx',
                    ports: [{ private: 3000 }]
                }),
                /daemon unreachable/
            );
            assert.deepEqual(releasedReservations, [[25001]]);
            assert.deepEqual(committedReservations, []);
            assert.equal(await Container.count(), 0);
        });

        it('leaves no orphan row behind when the relay cannot be opened', async () => {
            const fixture = await createFixture();
            const failing = buildDependencies();
            failing.relay = {
                ...failing.relay!,
                ensureContainerRelays: async () => {
                    throw new Error('relay refused');
                }
            };
            const failingService = new ContainerService(failing);

            await assert.rejects(
                () => failingService.create(fixture.team.id, fixture.owner.id, {
                    name: 'app',
                    image: 'nginx',
                    ports: [{ private: 3000 }]
                }),
                /relay refused/
            );
            assert.equal(await Container.count(), 0);
            assert.deepEqual(stoppedContainerRelays.length, 1);
        });
    });

    describe('list', () => {
        it('returns the containers of the team newest updated first', async () => {
            const fixture = await createFixture();
            const older = await seedContainer(fixture, { name: 'older' });
            const newer = await seedContainer(fixture, { name: 'newer' });
            await Container.update({ id: older.id }, { updatedAt: new Date('2024-01-01T00:00:00.000Z') });
            await Container.update({ id: newer.id }, { updatedAt: new Date('2024-06-01T00:00:00.000Z') });

            const page = await service.list(fixture.team.id, fixture.owner.id, {});

            assert.deepEqual(page.data.map((item) => item.name), ['newer', 'older']);
        });

        it('defaults to a page of one hundred containers', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture);

            const page = await service.list(fixture.team.id, fixture.owner.id, {});

            assert.equal(page.limit, 100);
            assert.equal(page.page, 1);
            assert.equal(page.total, 1);
            assert.equal(page.totalPages, 1);
        });

        it('caps the requested limit at five hundred', async () => {
            const fixture = await createFixture();

            const page = await service.list(fixture.team.id, fixture.owner.id, { limit: 5000 });

            assert.equal(page.limit, 500);
        });

        it('paginates while reporting the unpaged total', async () => {
            const fixture = await createFixture();
            for(const name of ['a', 'b', 'c']){
                await seedContainer(fixture, { name });
            }

            const page = await service.list(fixture.team.id, fixture.owner.id, {
                page: 2,
                limit: 2
            });

            assert.equal(page.total, 3);
            assert.equal(page.totalPages, 2);
            assert.equal(page.data.length, 1);
        });

        it('excludes the containers of other teams', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture);
            await seedContainer(fixture, { team: fixture.otherTeam.id });

            const page = await service.list(fixture.team.id, fixture.owner.id, {});

            assert.equal(page.total, 1);
        });

        it('lists every folder when no folder filter is given', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'stack');
            await seedContainer(fixture, { name: 'at-root' });
            await seedContainer(fixture, {
                name: 'in-folder',
                folder: folder.id
            });

            const page = await service.list(fixture.team.id, fixture.owner.id, {});

            assert.equal(page.total, 2);
        });

        it('filters the containers at the root when the folder is "root"', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'stack');
            await seedContainer(fixture, { name: 'at-root' });
            await seedContainer(fixture, {
                name: 'in-folder',
                folder: folder.id
            });

            const page = await service.list(fixture.team.id, fixture.owner.id, { folderId: 'root' });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].name, 'at-root');
        });

        it('filters the containers of an explicit folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'stack');
            await seedContainer(fixture, { name: 'at-root' });
            await seedContainer(fixture, {
                name: 'in-folder',
                folder: folder.id
            });

            const page = await service.list(fixture.team.id, fixture.owner.id, { folderId: folder.id });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].name, 'in-folder');
        });

        it('searches the name case insensitively', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, { name: 'Jupyter Lab' });
            await seedContainer(fixture, { name: 'postgres' });

            const page = await service.list(fixture.team.id, fixture.owner.id, { search: 'jupyter' });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].name, 'Jupyter Lab');
        });

        it('does not let a percent sign in the search match every container', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, { name: '100% cpu' });
            await seedContainer(fixture, { name: 'postgres' });

            const page = await service.list(fixture.team.id, fixture.owner.id, { search: '%' });

            assert.equal(page.data.some((item) => item.name === 'postgres'), false);
        });

        it('does not let an underscore in the search match any single character', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, { name: 'my_app' });
            await seedContainer(fixture, { name: 'myXapp' });

            const page = await service.list(fixture.team.id, fixture.owner.id, { search: 'my_app' });

            assert.equal(page.data.some((item) => item.name === 'myXapp'), false);
        });

        it('does not let a backslash in the search match every container', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, { name: 'postgres' });

            const page = await service.list(fixture.team.id, fixture.owner.id, { search: '\\' });

            assert.equal(page.data.some((item) => item.name === 'postgres'), false);
        });

        it('exposes the container id on the wire as _id and loads the user and cluster references', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            const page = await service.list(fixture.team.id, fixture.owner.id, {});
            const record = onTheWire<{
                _id: string;
                createdBy: { _id: string; email: string };
                teamCluster: { _id: string; name: string };
            }>(page.data[0]);

            assert.equal(record._id, container.id);
            assert.equal(record.createdBy._id, fixture.owner.id);
            assert.equal(record.createdBy.email, 'owner@volt.test');
            assert.equal(record.teamCluster._id, fixture.cluster.id);
            assert.equal(record.teamCluster.name, 'cluster');
        });

        it('reports a browser accessible port as available while the container runs', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, {
                ports: [{
                    private: 8080,
                    public: 24010
                }]
            });

            const page = await service.list(fixture.team.id, fixture.owner.id, {});

            assert.deepEqual(page.data[0].accessiblePorts, [{
                private: 8080,
                public: 24010,
                protocol: 'tcp',
                browserAccessible: true,
                status: 'available'
            }]);
        });

        it('reports the ports as unavailable while the container is stopped', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, {
                status: 'exited',
                ports: [{
                    private: 8080,
                    public: 24010
                }]
            });

            const page = await service.list(fixture.team.id, fixture.owner.id, {});
            const [port] = page.data[0].accessiblePorts as Array<{ status: string }>;

            assert.equal(port.status, 'unavailable');
        });

        it('marks a port that no browser can reach as not browser accessible', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, {
                ports: [{
                    private: 5432,
                    public: 24010
                }]
            });

            const page = await service.list(fixture.team.id, fixture.owner.id, {});
            const [port] = page.data[0].accessiblePorts as Array<{ browserAccessible: boolean }>;

            assert.equal(port.browserAccessible, false);
        });
    });

    describe('getById', () => {
        it('returns the container refreshed with the runtime status', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, { status: 'created' });
            nextRuntimeStatus = 'running';

            const { container: view } = await service.getById(fixture.team.id, container.id);

            assert.equal(view._id, container.id);
            assert.equal(view.status, 'running');
        });

        it('rejects an unknown container', async () => {
            await createFixture();

            await assert.rejects(
                () => service.getById('a'.repeat(24), 'b'.repeat(24)),
                isApplicationError('Container::NotFound', 404)
            );
        });

        it('rejects a container owned by another team', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await assert.rejects(
                () => service.getById(fixture.otherTeam.id, container.id),
                isApplicationError('Team::AccessDenied', 403)
            );
        });
    });

    describe('update', () => {
        it('starts the container and records the runtime status', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, { status: 'exited' });

            const result = await service.update(fixture.team.id, container.id, { action: 'start' });

            assert.equal(result.status, 'running');
            assert.equal((await Container.findOneBy({ id: container.id }))?.status, 'running');
        });

        it('stops the container and records the runtime status', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            const result = await service.update(fixture.team.id, container.id, { action: 'stop' });

            assert.equal(result.status, 'exited');
            assert.equal((await Container.findOneBy({ id: container.id }))?.status, 'exited');
        });

        it('restarts the container and reopens the relays of its public ports', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                ports: [
                    {
                        private: 8080,
                        public: 24010
                    },
                    { private: 5432 }
                ]
            });

            await service.update(fixture.team.id, container.id, { action: 'restart' });

            assert.deepEqual(ensuredRelays, [[{
                teamId: fixture.team.id,
                containerId: container.id,
                teamClusterId: fixture.cluster.id,
                internalIp: '172.17.0.2',
                privatePort: 8080,
                publicPort: 24010
            }]]);
        });

        it('records the new ip address reported after a restart', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, { internalIp: '172.17.0.2' });
            nextInternalIp = '172.17.0.9';

            await service.update(fixture.team.id, container.id, { action: 'restart' });

            assert.equal((await Container.findOneBy({ id: container.id }))?.internalIp, '172.17.0.9');
        });

        it('publishes the update event for an action', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await service.update(fixture.team.id, container.id, { action: 'stop' });

            assert.deepEqual(published, [{
                name: 'container.updated',
                payload: {
                    containerId: container.id,
                    teamId: fixture.team.id,
                    containerName: 'app'
                }
            }]);
        });

        it('replaces the environment variables', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                env: [{
                    key: 'OLD',
                    value: '1'
                }]
            });

            await service.update(fixture.team.id, container.id, {
                env: [{
                    key: 'NEW',
                    value: '2'
                }]
            });

            assert.deepEqual((await Container.findOneBy({ id: container.id }))?.env, [{
                key: 'NEW',
                value: '2'
            }]);
        });

        it('keeps the environment variables when the input omits them', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                env: [{
                    key: 'KEEP',
                    value: '1'
                }]
            });

            await service.update(fixture.team.id, container.id, {});

            assert.deepEqual((await Container.findOneBy({ id: container.id }))?.env, [{
                key: 'KEEP',
                value: '1'
            }]);
        });

        it('keeps the public port already assigned to a private port', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                ports: [{
                    private: 8080,
                    public: 24010
                }]
            });

            await service.update(fixture.team.id, container.id, { ports: [{ private: 8080 }] });

            assert.deepEqual((await Container.findOneBy({ id: container.id }))?.ports, [{
                private: 8080,
                public: 24010
            }]);
        });

        it('assigns a public port to a newly declared private port', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                ports: [{
                    private: 8080,
                    public: 24010
                }]
            });

            await service.update(fixture.team.id, container.id, {
                ports: [
                    { private: 8080 },
                    { private: 9090 }
                ]
            });

            assert.deepEqual((await Container.findOneBy({ id: container.id }))?.ports, [
                {
                    private: 8080,
                    public: 24010
                },
                {
                    private: 9090,
                    public: 25001
                }
            ]);
        });

        it('drops the relay of a port that is no longer declared', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                ports: [
                    {
                        private: 8080,
                        public: 24010
                    },
                    {
                        private: 9090,
                        public: 24011
                    }
                ]
            });

            await service.update(fixture.team.id, container.id, { ports: [{ private: 8080 }] });

            assert.deepEqual(syncedRelays, [{
                containerId: container.id,
                relays: [{
                    teamId: fixture.team.id,
                    containerId: container.id,
                    teamClusterId: fixture.cluster.id,
                    internalIp: '172.17.0.2',
                    privatePort: 8080,
                    publicPort: 24010
                }]
            }]);
        });

        it('rejects a private port declared more than once', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await assert.rejects(
                () => service.update(fixture.team.id, container.id, {
                    ports: [
                        { private: 8080 },
                        { private: 8080 }
                    ]
                }),
                isApplicationError('Validation::InvalidInput', 400)
            );
        });

        it('rejects a container without networking when new ports are requested', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, { internalIp: null });

            await assert.rejects(
                () => service.update(fixture.team.id, container.id, { ports: [{ private: 8080 }] }),
                isApplicationError('Container::PortUnavailable', 409)
            );
        });

        it('rejects a container that is not attached to a cluster', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);
            await detachCluster(container.id);

            await assert.rejects(
                () => service.update(fixture.team.id, container.id, { action: 'start' }),
                isApplicationError('TeamCluster::Missing', 409)
            );
        });

        it('rolls the reservations back when the relay refuses the new ports', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);
            const failing = buildDependencies();
            failing.relay = {
                ...failing.relay!,
                ensureContainerRelays: async () => {
                    throw new Error('relay refused');
                }
            };
            const failingService = new ContainerService(failing);

            await assert.rejects(
                () => failingService.update(fixture.team.id, container.id, { ports: [{ private: 8080 }] }),
                /relay refused/
            );
            assert.deepEqual(releasedReservations, [[25001]]);
            assert.deepEqual(stoppedPublicPortRelays, [[25001]]);
            assert.deepEqual((await Container.findOneBy({ id: container.id }))?.ports, []);
        });
    });

    describe('delete', () => {
        it('removes the runtime container, the row and its relays', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            const result = await service.delete(fixture.team.id, container.id, fixture.owner.id);

            assert.deepEqual(result, { message: 'Container deleted successfully' });
            assert.equal(await Container.countBy({ id: container.id }), 0);
            assert.deepEqual(stoppedContainerRelays, [container.id]);
            assert.ok(runtimeCalls.some((call) => call.action === 'remove'));
        });

        it('publishes the deletion event', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await service.delete(fixture.team.id, container.id, fixture.owner.id);

            assert.deepEqual(published, [{
                name: 'container.deleted',
                payload: {
                    containerId: container.id,
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    containerName: 'app'
                }
            }]);
        });

        it('rejects a container owned by another team', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await assert.rejects(
                () => service.delete(fixture.otherTeam.id, container.id, fixture.owner.id),
                isApplicationError('Team::AccessDenied', 403)
            );
            assert.equal(await Container.countBy({ id: container.id }), 1);
        });

        it('rejects an unknown container', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.delete(fixture.team.id, 'a'.repeat(24), fixture.owner.id),
                isApplicationError('Container::NotFound', 404)
            );
        });
    });

    describe('createPortAccessUrl', () => {
        it('returns a relay url for a running browser accessible port', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                ports: [{
                    private: 8080,
                    public: 24010
                }]
            });

            const access = await service.createPortAccessUrl(fixture.team.id, container.id, 8080, fixture.owner.id);

            assert.equal(access.url, `http://relay.test/${container.id}/8080`);
            assert.equal(access.expiresAt, '2024-01-01T00:00:00.000Z');
            assert.equal(access.port.private, 8080);
            assert.equal(access.port.public, 24010);
        });

        it('rejects a port that the container does not expose', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await assert.rejects(
                () => service.createPortAccessUrl(fixture.team.id, container.id, 8080, fixture.owner.id),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('rejects a port that no browser can reach', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                ports: [{
                    private: 5432,
                    public: 24010
                }]
            });

            await assert.rejects(
                () => service.createPortAccessUrl(fixture.team.id, container.id, 5432, fixture.owner.id),
                isApplicationError('Validation::InvalidInput', 400)
            );
        });

        it('rejects a port of a container that is not running', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                status: 'exited',
                ports: [{
                    private: 8080,
                    public: 24010
                }]
            });

            await assert.rejects(
                () => service.createPortAccessUrl(fixture.team.id, container.id, 8080, fixture.owner.id),
                isApplicationError('Container::PortUnavailable', 409)
            );
        });

        it('rejects a port without a public port assigned', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, { ports: [{ private: 8080 }] });

            await assert.rejects(
                () => service.createPortAccessUrl(fixture.team.id, container.id, 8080, fixture.owner.id),
                isApplicationError('Container::PublicPortUnavailable', 409)
            );
        });

        it('rejects a container whose networking is not ready', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                internalIp: null,
                ports: [{
                    private: 8080,
                    public: 24010
                }]
            });

            await assert.rejects(
                () => service.createPortAccessUrl(fixture.team.id, container.id, 8080, fixture.owner.id),
                isApplicationError('Container::PortUnavailable', 409)
            );
        });
    });

    describe('runtime passthrough', () => {
        it('lists the files of the container root by default', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            const { files } = await service.getFiles(fixture.team.id, container.id);

            assert.equal(files[0].name, 'app.js');
            assert.ok(runtimeCalls.some((call) => call.action === 'files:/'));
        });

        it('lists the files of an explicit path', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await service.getFiles(fixture.team.id, container.id, '/srv');

            assert.ok(runtimeCalls.some((call) => call.action === 'files:/srv'));
        });

        it('reads a file of the container', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            assert.deepEqual(
                await service.readFile(fixture.team.id, container.id, '/srv/app.js'),
                { content: 'file contents' }
            );
        });

        it('lists the processes of the container', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            const { processes } = await service.getProcesses(fixture.team.id, container.id);

            assert.deepEqual(processes, [{ pid: '1' }]);
        });

        it('derives the memory and network totals from the runtime stats', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, {
                memory: 512,
                cpus: 2
            });

            const stats = await service.getStats(fixture.team.id, container.id);

            assert.deepEqual(stats.limits, {
                memory: 512 * 1024 * 1024,
                cpus: 2
            });
            assert.deepEqual(stats.memoryMB, {
                used: 128,
                total: 512,
                free: 384
            });
            assert.deepEqual(stats.networkTotals, {
                rxBytes: 105,
                txBytes: 21
            });
        });

        it('rejects a runtime call on a container owned by another team', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await assert.rejects(
                () => service.getFiles(fixture.otherTeam.id, container.id),
                isApplicationError('Team::AccessDenied', 403)
            );
        });
    });

    describe('move', () => {
        it('moves a container into a folder', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);
            const folder = await seedFolder(fixture, 'stack');

            assert.equal(await service.move(fixture.team.id, container.id, folder.id), null);
            assert.equal((await Container.findOneBy({ id: container.id }))?.folder, folder.id);
        });

        it('moves a container back to the root', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'stack');
            const container = await seedContainer(fixture, { folder: folder.id });

            await service.move(fixture.team.id, container.id, null);

            assert.equal((await Container.findOneBy({ id: container.id }))?.folder, null);
        });

        it('rejects a container owned by another team', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await assert.rejects(
                () => service.move(fixture.otherTeam.id, container.id, null),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('rejects an unknown target folder', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await assert.rejects(
                () => service.move(fixture.team.id, container.id, 'a'.repeat(24)),
                isApplicationError('Resource::NotFound', 404)
            );
        });
    });

    describe('folders', () => {
        it('lists the root folders newest first with the default limit of five hundred', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            await seedFolder(fixture, 'child', root.id);

            const page = await service.listFolders(fixture.team.id, {});

            assert.equal(page.total, 1);
            assert.equal(page.limit, 500);
            assert.equal(page.data[0].title, 'root-one');
            assert.equal(page.data[0].parent, null);
        });

        it('caps the requested folder limit at five hundred', async () => {
            const fixture = await createFixture();

            assert.equal((await service.listFolders(fixture.team.id, { limit: 5000 })).limit, 500);
        });

        it('lists the children of a folder', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            await seedFolder(fixture, 'child', root.id);

            const page = await service.listFolders(fixture.team.id, { parentId: root.id });

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'child');
        });

        it('excludes the folders of another catalog kind', async () => {
            const fixture = await createFixture();
            await seedFolder(fixture, 'containers');
            await seedFolder(fixture, 'boards', null, CatalogFolderKind.Whiteboard);

            const page = await service.listFolders(fixture.team.id, {});

            assert.equal(page.total, 1);
            assert.equal(page.data[0].title, 'containers');
        });

        it('paginates the folder listing', async () => {
            const fixture = await createFixture();
            await seedFolder(fixture, 'one');
            await seedFolder(fixture, 'two');

            const page = await service.listFolders(fixture.team.id, {
                page: 2,
                limit: 1
            });

            assert.equal(page.total, 2);
            assert.equal(page.totalPages, 2);
            assert.equal(page.data.length, 1);
        });

        it('creates a folder tagged with the container kind', async () => {
            const fixture = await createFixture();

            const folder = await service.createFolder(fixture.team.id, fixture.owner.id, { title: 'created' });

            const stored = await CatalogFolder.findOneBy({ id: folder._id });
            assert.equal(stored?.kind, CatalogFolderKind.Container);
            assert.equal(stored?.team, fixture.team.id);
            assert.equal(stored?.createdBy, fixture.owner.id);
            assert.equal(stored?.parent, null);
        });

        it('creates a nested folder', async () => {
            const fixture = await createFixture();
            const parent = await seedFolder(fixture, 'parent');

            const folder = await service.createFolder(fixture.team.id, fixture.owner.id, {
                title: 'nested',
                parentId: parent.id
            });

            assert.equal(folder.parent, parent.id);
        });

        it('reads a single folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'readable');

            assert.equal((await service.getFolder(fixture.team.id, folder.id))._id, folder.id);
        });

        it('rejects reading a folder of another team', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'readable');

            await assert.rejects(
                () => service.getFolder(fixture.otherTeam.id, folder.id),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('renames a folder', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'before');

            assert.equal((await service.updateFolder(fixture.team.id, folder.id, { title: 'after' })).title, 'after');
            assert.equal((await CatalogFolder.findOneBy({ id: folder.id }))?.title, 'after');
        });

        it('rejects renaming an unknown folder', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.updateFolder(fixture.team.id, 'a'.repeat(24), { title: 'after' }),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('deletes a folder tree including its subfolders', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            const child = await seedFolder(fixture, 'child', root.id);
            const survivor = await seedFolder(fixture, 'survivor');

            assert.equal(await service.deleteFolder(fixture.team.id, root.id, fixture.owner.id), null);
            assert.equal(await CatalogFolder.countBy({ id: root.id }), 0);
            assert.equal(await CatalogFolder.countBy({ id: child.id }), 0);
            assert.equal(await CatalogFolder.countBy({ id: survivor.id }), 1);
        });

        it('deletes the containers stored inside the folder tree', async () => {
            const fixture = await createFixture();
            const root = await seedFolder(fixture, 'root-one');
            const child = await seedFolder(fixture, 'child', root.id);
            const doomed = await seedContainer(fixture, { folder: root.id });
            const nested = await seedContainer(fixture, { folder: child.id });
            const survivor = await seedContainer(fixture);

            await service.deleteFolder(fixture.team.id, root.id, fixture.owner.id);

            assert.equal(await Container.countBy({ id: doomed.id }), 0);
            assert.equal(await Container.countBy({ id: nested.id }), 0);
            assert.equal(await Container.countBy({ id: survivor.id }), 1);
        });

        it('rejects deleting an unknown folder', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.deleteFolder(fixture.team.id, 'a'.repeat(24), fixture.owner.id),
                isApplicationError('Resource::NotFound', 404)
            );
        });

        it('detaches the containers of a folder removed straight from the database', async () => {
            const fixture = await createFixture();
            const folder = await seedFolder(fixture, 'stack');
            const container = await seedContainer(fixture, { folder: folder.id });

            await CatalogFolder.delete({ id: folder.id });

            assert.equal((await Container.findOneBy({ id: container.id }))?.folder, null);
        });
    });

    describe('cluster deletion cascade', () => {
        it('removes the containers of a deleted cluster', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture);

            await TeamCluster.delete({ id: fixture.cluster.id });

            assert.equal(await Container.countBy({ id: container.id }), 0);
        });
    });
});
