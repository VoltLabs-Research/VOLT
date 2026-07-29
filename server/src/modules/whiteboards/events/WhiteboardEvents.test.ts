import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import WhiteboardEvents from '@modules/whiteboards/events/WhiteboardEvents';
import type { WhiteboardServiceDependencies } from '@modules/whiteboards/services/WhiteboardService';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

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

const ENTITIES = [Whiteboard, TeamCluster, CatalogFolder, Team, User];

describe('WhiteboardEvents', () => {
    let dataSource: DataSource;
    let events: WhiteboardEvents;
    const published: EmittedEvent[] = [];
    const deletedPrefixes: Array<{ bucket: string; prefix: string }> = [];
    let deletePrefixFailure: string | null;

    const buildDependencies = (): WhiteboardServiceDependencies => ({
        objectGatewayClient: {
            putBuffer: async () => {},
            exists: async () => false,
            getStream: async () => {
                throw new Error('unused');
            },
            deleteByPrefix: async (_teamClusterId, bucket, prefix) => {
                if(deletePrefixFailure !== null && prefix.includes(deletePrefixFailure)){
                    throw new Error('gateway down');
                }
                deletedPrefixes.push({
                    bucket,
                    prefix
                });
                return 0;
            }
        } as WhiteboardServiceDependencies['objectGatewayClient'],
        clusterSelection: { resolveStorageClusterId: async () => '' },
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
        deletedPrefixes.length = 0;
        deletePrefixFailure = null;
        events = new WhiteboardEvents(buildDependencies());
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

    const seedWhiteboard = (
        fixture: Fixture,
        overrides: Partial<Whiteboard> = {}
    ): Promise<Whiteboard> => Whiteboard.create({
        team: fixture.team.id,
        createdBy: fixture.owner.id,
        lastEditedBy: fixture.owner.id,
        title: 'Board',
        storageClusterId: fixture.cluster.id,
        payloadKey: 'state.json',
        folder: null,
        ...overrides
    }).save();

    describe('deleteTeamWhiteboards', () => {
        it('deletes every whiteboard of the team', async () => {
            const fixture = await createFixture();
            const first = await seedWhiteboard(fixture);
            const second = await seedWhiteboard(fixture);

            await events.deleteTeamWhiteboards({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await Whiteboard.countBy({ id: first.id }), 0);
            assert.equal(await Whiteboard.countBy({ id: second.id }), 0);
        });

        it('keeps the whiteboards of the other teams', async () => {
            const fixture = await createFixture();
            await seedWhiteboard(fixture);
            const survivor = await seedWhiteboard(fixture, { team: fixture.otherTeam.id });

            await events.deleteTeamWhiteboards({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await Whiteboard.countBy({ id: survivor.id }), 1);
        });

        it('clears the stored objects of every deleted whiteboard', async () => {
            const fixture = await createFixture();
            const first = await seedWhiteboard(fixture);
            const second = await seedWhiteboard(fixture);

            await events.deleteTeamWhiteboards({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(
                deletedPrefixes.map((entry) => entry.prefix).sort(),
                [
                    `${fixture.team.id}/${first.id}/`,
                    `${fixture.team.id}/${second.id}/`
                ].sort()
            );
            assert.deepEqual(
                new Set(deletedPrefixes.map((entry) => entry.bucket)),
                new Set([TEAM_CLUSTER_BUCKETS.WHITEBOARDS])
            );
        });

        it('publishes one deletion event per whiteboard', async () => {
            const fixture = await createFixture();
            const first = await seedWhiteboard(fixture);
            const second = await seedWhiteboard(fixture);

            await events.deleteTeamWhiteboards({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(published.map((event) => event.name), ['whiteboard.deleted', 'whiteboard.deleted']);
            assert.deepEqual(
                published.map((event) => (event.payload as { whiteboardId: string }).whiteboardId).sort(),
                [first.id, second.id].sort()
            );
        });

        it('keeps deleting the remaining whiteboards when one of them fails', async () => {
            const fixture = await createFixture();
            const broken = await seedWhiteboard(fixture, { storageClusterId: null });
            const healthy = await seedWhiteboard(fixture);

            await events.deleteTeamWhiteboards({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(await Whiteboard.countBy({ id: broken.id }), 0);
            assert.equal(await Whiteboard.countBy({ id: healthy.id }), 0);
            assert.deepEqual(published.map((event) => event.name), ['whiteboard.deleted']);
        });

        it('resolves when the team has no whiteboard', async () => {
            const fixture = await createFixture();

            await events.deleteTeamWhiteboards({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(published, []);
        });

        it('tolerates an event without a user id', async () => {
            const fixture = await createFixture();
            const whiteboard = await seedWhiteboard(fixture);

            await events.deleteTeamWhiteboards({ teamId: fixture.team.id });

            assert.equal(await Whiteboard.countBy({ id: whiteboard.id }), 0);
            assert.equal((published[0].payload as { userId: string }).userId, '');
        });
    });
});
