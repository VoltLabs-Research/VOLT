import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { ContainerPublicPortAllocator } from '@modules/container/services/ContainerPublicPortAllocator';
import Container from '@modules/container/models/Container';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ContainerPortMapping } from '@shared/contracts/ports/IContainerService';

interface Fixture{
    team: Team;
    owner: User;
    cluster: TeamCluster;
}

const ENTITIES = [Container, TeamCluster, CatalogFolder, Team, User];

const PORT_RANGE_START = 24000;
const PORT_RANGE_END = 24999;

const isApplicationError = (code: string, statusCode: number) => (error: unknown): boolean => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
};

describe('ContainerPublicPortAllocator', () => {
    let dataSource: DataSource;
    let allocator: ContainerPublicPortAllocator;

    before(async () => {
        dataSource = await createHarness(ENTITIES);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        allocator = new ContainerPublicPortAllocator();
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
        env: [],
        ports,
        ...overrides
    }).save();

    describe('simple-json port persistence', () => {
        it('round trips the port mappings through the json column', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, [
                {
                    private: 3000,
                    public: 24010
                },
                { private: 5432 }
            ]);

            assert.deepEqual((await Container.findOneBy({ id: container.id }))?.ports, [
                {
                    private: 3000,
                    public: 24010
                },
                { private: 5432 }
            ]);
        });

        it('round trips the environment variables through the json column', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, [], {
                env: [{
                    key: 'MODE',
                    value: 'test'
                }]
            });

            assert.deepEqual((await Container.findOneBy({ id: container.id }))?.env, [{
                key: 'MODE',
                value: 'test'
            }]);
        });

        it('defaults the port and environment lists to empty arrays', async () => {
            const fixture = await createFixture();
            const container = await Container.create({
                name: 'app',
                image: 'nginx',
                containerId: 'docker-defaults',
                team: fixture.team.id,
                teamCluster: fixture.cluster.id,
                createdBy: fixture.owner.id
            }).save();

            const stored = await Container.findOneBy({ id: container.id });
            assert.deepEqual(stored?.ports, []);
            assert.deepEqual(stored?.env, []);
        });
    });

    describe('reservePortMappings', () => {
        it('returns nothing when no port is requested', async () => {
            await createFixture();

            assert.deepEqual(await allocator.reservePortMappings(undefined), {
                ports: [],
                reservedPublicPorts: []
            });
            assert.deepEqual(await allocator.reservePortMappings([]), {
                ports: [],
                reservedPublicPorts: []
            });
        });

        it('detects a public port already assigned to another container', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, [{
                private: 3000,
                public: 24010
            }]);

            await assert.rejects(
                () => allocator.reservePortMappings([{
                    private: 8080,
                    public: 24010
                }]),
                isApplicationError('Container::PublicPortUnavailable', 409)
            );
        });

        it('detects an assigned public port that sits past the first entry of the json array', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, [
                {
                    private: 3000,
                    public: 24010
                },
                {
                    private: 3001,
                    public: 24011
                }
            ]);

            await assert.rejects(
                () => allocator.reservePortMappings([{
                    private: 8080,
                    public: 24011
                }]),
                isApplicationError('Container::PublicPortUnavailable', 409)
            );
        });

        it('detects an assigned public port on a container of another team', async () => {
            const fixture = await createFixture();
            const otherOwner = await User.create({
                email: 'other@volt.test',
                firstName: 'other'
            }).save();
            const otherTeam = await Team.create({
                name: 'Team Two',
                owner: otherOwner.id
            }).save();
            await seedContainer(fixture, [{
                private: 3000,
                public: 24010
            }], { team: otherTeam.id });

            await assert.rejects(
                () => allocator.reservePortMappings([{
                    private: 8080,
                    public: 24010
                }]),
                isApplicationError('Container::PublicPortUnavailable', 409)
            );
        });

        it('ignores the ports of the excluded container', async () => {
            const fixture = await createFixture();
            const container = await seedContainer(fixture, [{
                private: 3000,
                public: 24010
            }]);

            const reserved = await allocator.reservePortMappings(
                [{
                    private: 3000,
                    public: 24010
                }],
                { excludeContainerId: container.id }
            );

            assert.deepEqual(reserved.ports, [{
                private: 3000,
                public: 24010
            }]);
            assert.deepEqual(reserved.reservedPublicPorts, [24010]);
        });

        it('still detects the port of a container that is not the excluded one', async () => {
            const fixture = await createFixture();
            const excluded = await seedContainer(fixture, [{
                private: 3000,
                public: 24010
            }]);
            await seedContainer(fixture, [{
                private: 3000,
                public: 24011
            }]);

            await assert.rejects(
                () => allocator.reservePortMappings(
                    [{
                        private: 8080,
                        public: 24011
                    }],
                    { excludeContainerId: excluded.id }
                ),
                isApplicationError('Container::PublicPortUnavailable', 409)
            );
        });

        it('ignores a container whose json port list is empty', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, []);

            const reserved = await allocator.reservePortMappings([{
                private: 8080,
                public: 24010
            }]);

            assert.deepEqual(reserved.ports, [{
                private: 8080,
                public: 24010
            }]);
        });

        it('ignores a container whose mapping has no public port', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, [{ private: 24010 }]);

            const reserved = await allocator.reservePortMappings([{
                private: 8080,
                public: 24010
            }]);

            assert.deepEqual(reserved.ports, [{
                private: 8080,
                public: 24010
            }]);
        });

        it('rejects a requested public port below the allowed range', async () => {
            await createFixture();

            await assert.rejects(
                () => allocator.reservePortMappings([{
                    private: 8080,
                    public: PORT_RANGE_START - 1
                }]),
                isApplicationError('Validation::InvalidInput', 400)
            );
        });

        it('rejects a requested public port above the allowed range', async () => {
            await createFixture();

            await assert.rejects(
                () => allocator.reservePortMappings([{
                    private: 8080,
                    public: PORT_RANGE_END + 1
                }]),
                isApplicationError('Validation::InvalidInput', 400)
            );
        });

        it('rejects a private port declared more than once', async () => {
            await createFixture();

            await assert.rejects(
                () => allocator.reservePortMappings([
                    {
                        private: 8080,
                        public: 24010
                    },
                    {
                        private: 8080,
                        public: 24011
                    }
                ]),
                isApplicationError('Validation::InvalidInput', 400)
            );
        });

        it('refuses to hand the same public port to two mappings of one request', async () => {
            await createFixture();

            await assert.rejects(
                () => allocator.reservePortMappings([
                    {
                        private: 8080,
                        public: 24010
                    },
                    {
                        private: 9090,
                        public: 24010
                    }
                ]),
                isApplicationError('Container::PublicPortUnavailable', 409)
            );
        });

        it('releases the ports it had already taken when a later mapping fails', async () => {
            await createFixture();

            await assert.rejects(() => allocator.reservePortMappings([
                {
                    private: 8080,
                    public: 24010
                },
                {
                    private: 9090,
                    public: PORT_RANGE_END + 1
                }
            ]));

            const retry = await allocator.reservePortMappings([{
                private: 8080,
                public: 24010
            }]);
            assert.deepEqual(retry.ports, [{
                private: 8080,
                public: 24010
            }]);
        });

        it('auto assigns a public port inside the allowed range', async () => {
            await createFixture();

            const reserved = await allocator.reservePortMappings([{ private: 8080 }]);

            assert.equal(reserved.ports[0].private, 8080);
            assert.ok(reserved.ports[0].public !== undefined);
            assert.ok(allocator.isInPublicRange(reserved.ports[0].public));
        });

        it('skips the auto assigned port that another container already holds', async () => {
            const fixture = await createFixture();
            await seedContainer(fixture, [{
                private: 3000,
                public: PORT_RANGE_START
            }]);

            const reserved = await allocator.reservePortMappings([{ private: 8080 }]);

            assert.notEqual(reserved.ports[0].public, PORT_RANGE_START);
        });
    });

    describe('reservation bookkeeping', () => {
        it('holds an uncommitted reservation against a second request', async () => {
            await createFixture();
            await allocator.reservePortMappings([{
                private: 8080,
                public: 24010
            }]);

            await assert.rejects(
                () => allocator.reservePortMappings([{
                    private: 9090,
                    public: 24010
                }]),
                isApplicationError('Container::PublicPortUnavailable', 409)
            );
        });

        it('frees the port once the reservation is committed', async () => {
            await createFixture();
            const reserved = await allocator.reservePortMappings([{
                private: 8080,
                public: 24010
            }]);

            allocator.commitReservations(reserved.reservedPublicPorts);

            const second = await allocator.reservePortMappings([{
                private: 9090,
                public: 24010
            }]);
            assert.equal(second.ports[0].public, 24010);
        });

        it('frees the port once the reservation is released', async () => {
            await createFixture();
            const reserved = await allocator.reservePortMappings([{
                private: 8080,
                public: 24010
            }]);

            allocator.releaseReservations(reserved.reservedPublicPorts);

            const second = await allocator.reservePortMappings([{
                private: 9090,
                public: 24010
            }]);
            assert.equal(second.ports[0].public, 24010);
        });
    });

    describe('isInPublicRange', () => {
        it('accepts the bounds of the range and rejects everything outside', async () => {
            assert.equal(allocator.isInPublicRange(PORT_RANGE_START), true);
            assert.equal(allocator.isInPublicRange(PORT_RANGE_END), true);
            assert.equal(allocator.isInPublicRange(PORT_RANGE_START - 1), false);
            assert.equal(allocator.isInPublicRange(PORT_RANGE_END + 1), false);
        });

        it('rejects a port that is not an integer', async () => {
            assert.equal(allocator.isInPublicRange(24000.5), false);
        });
    });
});
