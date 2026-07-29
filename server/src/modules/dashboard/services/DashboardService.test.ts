import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import Analysis from '@modules/analysis/models/Analysis';
import Chat from '@modules/chat/models/Chat';
import ChatMessage from '@modules/chat/models/ChatMessage';
import Container from '@modules/container/models/Container';
import Plugin from '@modules/plugin/models/Plugin';
import Team from '@modules/team/models/Team';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import Trajectory from '@modules/trajectory/models/Trajectory';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';
import User from '@modules/auth/models/User';
import DashboardService from '@modules/dashboard/services/DashboardService';
import type { ModifierNodeData } from '@modules/plugin/models/plugin/workflow/WorkflowTypes';

interface TeamFixture{
    team: Team;
    owner: User;
    role: TeamRole;
    cluster: TeamCluster;
}

const EMPTY_WORKFLOW = {
    nodes: [],
    edges: []
};

const modifier = (name: string, description?: string): ModifierNodeData => ({
    key: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    ...(description === undefined ? {} : { description })
} as unknown as ModifierNodeData);

describe('DashboardService', () => {
    let dataSource: DataSource;
    const service = new DashboardService();

    before(async () => {
        dataSource = await createHarness([
            Analysis,
            Chat,
            ChatMessage,
            Container,
            Plugin,
            Team,
            TeamCluster,
            TeamMember,
            TeamRole,
            Trajectory,
            CatalogFolder,
            User
        ]);
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createUser = (email: string, firstName = 'ada', lastName = 'lovelace'): Promise<User> => User.create({
        email,
        firstName,
        lastName
    }).save();

    const createTeamFixture = async (name: string, owner?: User): Promise<TeamFixture> => {
        const teamOwner = owner ?? await createUser(`owner-${name}@volt.test`);
        const team = await Team.create({
            name,
            owner: teamOwner.id
        }).save();
        const role = await TeamRole.create({
            team: team.id,
            name: `role-${name}`,
            permissions: []
        }).save();
        await TeamMember.create({
            team: team.id,
            user: teamOwner.id,
            role: role.id
        }).save();
        const cluster = await TeamCluster.create({
            name: `cluster-${name}`,
            team: team.id,
            createdBy: teamOwner.id,
            services: {},
            queueConcurrency: {},
            queueScopeLimits: {},
            roleConfig: {}
        }).save();

        return {
            team,
            owner: teamOwner,
            role,
            cluster
        };
    };

    const createPlugin = async (
        fixture: TeamFixture,
        modifierData: ModifierNodeData | null,
        updatedAt?: Date
    ): Promise<Plugin> => {
        const plugin = await Plugin.create({
            team: fixture.team.id,
            workflow: EMPTY_WORKFLOW,
            modifier: modifierData
        }).save();

        if(updatedAt){
            await Plugin.update({ id: plugin.id }, { updatedAt });
        }

        return plugin;
    };

    const createTrajectory = (fixture: TeamFixture, name: string): Promise<Trajectory> => Trajectory.create({
        name,
        team: fixture.team.id,
        createdBy: fixture.owner.id,
        storageClusterId: fixture.cluster.id,
        folder: null
    }).save();

    const createAnalysis = async (
        fixture: TeamFixture,
        trajectory: Trajectory,
        overrides: Partial<Analysis> = {}
    ): Promise<Analysis> => {
        const plugin = await createPlugin(fixture, modifier('Radial'));

        return Analysis.create({
            team: fixture.team.id,
            trajectory: trajectory.id,
            plugin: plugin.id,
            pluginDisplayName: 'Radial Distribution',
            config: {},
            createdBy: fixture.owner.id,
            computeClusterId: fixture.cluster.id,
            storageClusterId: fixture.cluster.id,
            ...overrides
        }).save();
    };

    const createContainer = (fixture: TeamFixture, name: string): Promise<Container> => Container.create({
        name,
        image: 'volt/base',
        containerId: `docker-${name}`,
        team: fixture.team.id,
        teamCluster: fixture.cluster.id,
        createdBy: fixture.owner.id,
        folder: null
    }).save();

    const createChat = async (
        fixture: TeamFixture,
        participants: User[],
        lastMessageContent?: string
    ): Promise<Chat> => {
        const chat = await Chat.create({
            team: fixture.team.id,
            participants: participants.map((participant) => participant.id),
            createdBy: fixture.owner.id,
            isActive: true
        }).save();

        if(lastMessageContent !== undefined){
            const message = await ChatMessage.create({
                chat: chat.id,
                sender: participants[0].id,
                content: lastMessageContent
            }).save();
            await Chat.update({ id: chat.id }, {
                lastMessage: message.id,
                lastMessageAt: new Date()
            });
        }

        return chat;
    };

    describe('query length', () => {
        it('returns empty results for a query shorter than two characters', async () => {
            const fixture = await createTeamFixture('one');
            await createPlugin(fixture, modifier('Radial Distribution'));

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'r'
            });

            assert.deepEqual(result, {
                analyses: [],
                containers: [],
                trajectories: [],
                teams: [],
                plugins: [],
                chats: []
            });
        });

        it('returns empty results for a missing query', async () => {
            const fixture = await createTeamFixture('one');

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(result.plugins, []);
        });
    });

    describe('plugins', () => {
        it('finds a plugin by the name of its modifier', async () => {
            const fixture = await createTeamFixture('one');
            const target = await createPlugin(fixture, modifier('Radial Distribution'));
            await createPlugin(fixture, modifier('Coordination Number'));

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.plugins.map((plugin) => plugin._id), [target.id]);
        });

        it('finds a plugin by the description of its modifier', async () => {
            const fixture = await createTeamFixture('one');
            const target = await createPlugin(fixture, modifier('Coordination Number', 'Counts the radial neighbours'));
            await createPlugin(fixture, modifier('Displacement', 'Tracks the drift'));

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'neighbours'
            });

            assert.deepEqual(result.plugins.map((plugin) => plugin._id), [target.id]);
        });

        it('matches the modifier name case insensitively', async () => {
            const fixture = await createTeamFixture('one');
            const target = await createPlugin(fixture, modifier('Radial Distribution'));

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'RADIAL'
            });

            assert.deepEqual(result.plugins.map((plugin) => plugin._id), [target.id]);
        });

        it('ignores a plugin without a persisted modifier', async () => {
            const fixture = await createTeamFixture('one');
            await createPlugin(fixture, null);

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.plugins, []);
        });

        it('excludes the plugins of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two', fixture.owner);
            await createPlugin(otherFixture, modifier('Radial Distribution'));

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.plugins, []);
        });

        it('returns the most recently updated matching plugin first', async () => {
            const fixture = await createTeamFixture('one');
            const older = await createPlugin(fixture, modifier('Radial One'), new Date('2024-01-01T00:00:00.000Z'));
            const newer = await createPlugin(fixture, modifier('Radial Two'), new Date('2024-06-01T00:00:00.000Z'));

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.plugins.map((plugin) => plugin._id), [newer.id, older.id]);
        });

        it('keeps only the first page of matches when the limit is smaller than the match count', async () => {
            const fixture = await createTeamFixture('one');
            const oldest = await createPlugin(fixture, modifier('Radial One'), new Date('2024-01-01T00:00:00.000Z'));
            const middle = await createPlugin(fixture, modifier('Radial Two'), new Date('2024-03-01T00:00:00.000Z'));
            const newest = await createPlugin(fixture, modifier('Radial Three'), new Date('2024-06-01T00:00:00.000Z'));

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial',
                limit: 2
            });

            assert.deepEqual(result.plugins.map((plugin) => plugin._id), [newest.id, middle.id]);
            assert.equal(result.plugins.some((plugin) => plugin._id === oldest.id), false);
        });

        it('defaults the page size to five and caps it at ten', async () => {
            const fixture = await createTeamFixture('one');
            for(let index = 0; index < 11; index++){
                await createPlugin(fixture, modifier(`Radial ${index}`));
            }

            const defaulted = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial'
            });
            const capped = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial',
                limit: 50
            });

            assert.equal(defaulted.plugins.length, 5);
            assert.equal(capped.plugins.length, 10);
        });

        it('raises a page size below one back to a single result', async () => {
            const fixture = await createTeamFixture('one');
            await createPlugin(fixture, modifier('Radial One'));
            await createPlugin(fixture, modifier('Radial Two'));

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial',
                limit: 0
            });

            assert.equal(result.plugins.length, 1);
        });

        it('rebuilds the workflow projection of every matching plugin', async () => {
            const fixture = await createTeamFixture('one');
            await createPlugin(fixture, modifier('Radial Distribution'));

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial'
            });

            assert.equal(result.plugins[0].modifier?.name, 'Radial Distribution');
            assert.equal(Object.prototype.hasOwnProperty.call(result.plugins[0], 'id'), false);
        });
    });

    describe('analyses', () => {
        it('finds an analysis by its plugin display name', async () => {
            const fixture = await createTeamFixture('one');
            const trajectory = await createTrajectory(fixture, 'Water Box');
            const target = await createAnalysis(fixture, trajectory);
            await createAnalysis(fixture, trajectory, { pluginDisplayName: 'Coordination Number' });

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.analyses.map((analysis) => analysis._id), [target.id]);
        });

        it('finds an analysis through the name of its trajectory', async () => {
            const fixture = await createTeamFixture('one');
            const trajectory = await createTrajectory(fixture, 'Water Box');
            const target = await createAnalysis(fixture, trajectory, { pluginDisplayName: 'Coordination Number' });

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'water'
            });

            assert.deepEqual(result.analyses.map((analysis) => analysis._id), [target.id]);
        });

        it('finds an analysis by its exact id', async () => {
            const fixture = await createTeamFixture('one');
            const trajectory = await createTrajectory(fixture, 'Solvent');
            const target = await createAnalysis(fixture, trajectory, {
                id: 'a1b2c3d4e5f6a1b2c3d4e5f6',
                pluginDisplayName: 'Coordination Number'
            });

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: target.id
            });

            assert.deepEqual(result.analyses.map((analysis) => analysis._id), [target.id]);
        });

        it('projects the loaded trajectory of an analysis as an object with its name', async () => {
            const fixture = await createTeamFixture('one');
            const trajectory = await createTrajectory(fixture, 'Water Box');
            await createAnalysis(fixture, trajectory);

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.analyses[0].trajectory, {
                _id: trajectory.id,
                name: 'Water Box'
            });
        });

        it('excludes the analyses of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two', fixture.owner);
            const trajectory = await createTrajectory(otherFixture, 'Water Box');
            await createAnalysis(otherFixture, trajectory);

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.analyses, []);
        });
    });

    describe('trajectories and containers', () => {
        it('finds a trajectory by name', async () => {
            const fixture = await createTeamFixture('one');
            const target = await createTrajectory(fixture, 'Water Box');
            await createTrajectory(fixture, 'Metal Slab');

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'water'
            });

            assert.deepEqual(result.trajectories.map((trajectory) => trajectory._id), [target.id]);
        });

        it('finds a container by name', async () => {
            const fixture = await createTeamFixture('one');
            const target = await createContainer(fixture, 'jupyter-runner');
            await createContainer(fixture, 'postgres');

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'jupyter'
            });

            assert.deepEqual(result.containers.map((container) => container._id), [target.id]);
        });

        it('excludes the containers of another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two', fixture.owner);
            await createContainer(otherFixture, 'jupyter-runner');

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'jupyter'
            });

            assert.deepEqual(result.containers, []);
        });
    });

    describe('teams', () => {
        it('finds a team of the user by name', async () => {
            const owner = await createUser('owner@volt.test');
            const fixture = await createTeamFixture('Radial Lab', owner);
            await createTeamFixture('Other Lab', owner);

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.teams.map((team) => team.id), [fixture.team.id]);
        });

        it('finds a team of the user by description', async () => {
            const owner = await createUser('owner@volt.test');
            const fixture = await createTeamFixture('Alpha', owner);
            await Team.update({ id: fixture.team.id }, { description: 'The radial research group' });

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.teams.map((team) => team.id), [fixture.team.id]);
        });

        it('excludes a team the user does not belong to', async () => {
            const owner = await createUser('owner@volt.test');
            const stranger = await createUser('stranger@volt.test');
            const fixture = await createTeamFixture('Alpha', owner);
            await createTeamFixture('Radial Lab', stranger);

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.teams, []);
        });
    });

    describe('chats', () => {
        it('finds a chat by the name of a participant', async () => {
            const fixture = await createTeamFixture('one');
            const partner = await createUser('partner@volt.test', 'grace', 'hopper');
            const target = await createChat(fixture, [fixture.owner, partner]);

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'grace'
            });

            assert.deepEqual(result.chats.map((chat) => chat._id), [target.id]);
        });

        it('finds a chat by the content of its last message', async () => {
            const fixture = await createTeamFixture('one');
            const partner = await createUser('partner@volt.test', 'grace', 'hopper');
            const target = await createChat(fixture, [fixture.owner, partner], 'look at the radial plot');

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'radial'
            });

            assert.deepEqual(result.chats.map((chat) => chat._id), [target.id]);
        });

        it('excludes a chat the user does not participate in', async () => {
            const fixture = await createTeamFixture('one');
            const first = await createUser('first@volt.test', 'grace', 'hopper');
            const second = await createUser('second@volt.test', 'alan', 'turing');
            await createChat(fixture, [first, second]);

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'grace'
            });

            assert.deepEqual(result.chats, []);
        });

        it('excludes an inactive chat', async () => {
            const fixture = await createTeamFixture('one');
            const partner = await createUser('partner@volt.test', 'grace', 'hopper');
            const chat = await createChat(fixture, [fixture.owner, partner]);
            await Chat.update({ id: chat.id }, { isActive: false });

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'grace'
            });

            assert.deepEqual(result.chats, []);
        });

        it('returns the chats of every team the user talks in because the chat search ignores the requested team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two', fixture.owner);
            const partner = await createUser('partner@volt.test', 'grace', 'hopper');
            const foreignChat = await createChat(otherFixture, [fixture.owner, partner]);

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'grace'
            });

            assert.deepEqual(result.chats.map((chat) => chat._id), [foreignChat.id]);
            assert.equal(
                (result.chats[0] as unknown as { team?: string }).team,
                otherFixture.team.id
            );
        });

        it('resolves the participants of a chat into user records', async () => {
            const fixture = await createTeamFixture('one');
            const partner = await createUser('partner@volt.test', 'grace', 'hopper');
            await createChat(fixture, [fixture.owner, partner]);

            const result = await service.getGlobalSearch({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                query: 'grace'
            });
            const participants = result.chats[0].participants as unknown as Array<{ id: string }>;

            assert.deepEqual(participants.map((participant) => participant.id), [fixture.owner.id, partner.id]);
        });
    });
});
