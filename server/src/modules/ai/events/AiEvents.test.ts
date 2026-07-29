import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import AIConversation from '@modules/ai/models/AIConversation';
import AIMessage from '@modules/ai/models/AIMessage';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import AiEvents from '@modules/ai/events/AiEvents';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';

describe('AiEvents', () => {
    let dataSource: DataSource;
    const events = new AiEvents();

    before(async () => {
        dataSource = await createHarness([AIConversation, AIMessage, Team, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createUser = (email: string): Promise<User> => User.create({
        email,
        firstName: 'ada'
    }).save();

    const createTeam = (name: string, owner: User): Promise<Team> => Team.create({
        name,
        owner: owner.id
    }).save();

    const seedConversation = async (team: Team, user: User, title = 'New Conversation'): Promise<AIConversation> => {
        const conversation = await AIConversation.create({
            teamId: team.id,
            userId: user.id,
            title
        }).save();

        await AIMessage.create({
            conversationId: conversation.id,
            role: AIMessageRole.User,
            parts: [],
            content: 'hello'
        }).save();
        await AIMessage.create({
            conversationId: conversation.id,
            role: AIMessageRole.Assistant,
            parts: [],
            content: 'hi'
        }).save();

        return conversation;
    };

    describe('deleteTeamConversations', () => {
        it('deletes the conversations of the team with their messages', async () => {
            const owner = await createUser('owner@volt.test');
            const team = await createTeam('one', owner);
            const conversation = await seedConversation(team, owner);

            await events.deleteTeamConversations({ teamId: team.id } as EventMap['team.deleted']);

            assert.equal(await AIConversation.countBy({ teamId: team.id }), 0);
            assert.equal(await AIMessage.countBy({ conversationId: conversation.id }), 0);
        });

        it('keeps the conversations of another team', async () => {
            const owner = await createUser('owner@volt.test');
            const team = await createTeam('one', owner);
            const otherTeam = await createTeam('two', owner);
            await seedConversation(team, owner);
            const survivor = await seedConversation(otherTeam, owner);

            await events.deleteTeamConversations({ teamId: team.id } as EventMap['team.deleted']);

            const remaining = await AIConversation.find();
            assert.deepEqual(remaining.map((conversation) => conversation.id), [survivor.id]);
            assert.equal(await AIMessage.countBy({ conversationId: survivor.id }), 2);
        });

        it('does nothing when the team has no conversation', async () => {
            const owner = await createUser('owner@volt.test');
            const team = await createTeam('one', owner);
            const otherTeam = await createTeam('two', owner);
            await seedConversation(otherTeam, owner);

            await events.deleteTeamConversations({ teamId: team.id } as EventMap['team.deleted']);

            assert.equal(await AIConversation.count(), 1);
            assert.equal(await AIMessage.count(), 2);
        });
    });

    describe('deleteUserConversations', () => {
        it('deletes the conversations of the user with their messages', async () => {
            const owner = await createUser('owner@volt.test');
            const team = await createTeam('one', owner);
            const conversation = await seedConversation(team, owner);

            await events.deleteUserConversations({ userId: owner.id } as EventMap['user.deleted']);

            assert.equal(await AIConversation.countBy({ userId: owner.id }), 0);
            assert.equal(await AIMessage.countBy({ conversationId: conversation.id }), 0);
        });

        it('keeps the conversations of another user of the same team', async () => {
            const owner = await createUser('owner@volt.test');
            const other = await createUser('other@volt.test');
            const team = await createTeam('one', owner);
            await seedConversation(team, owner);
            const survivor = await seedConversation(team, other);

            await events.deleteUserConversations({ userId: owner.id } as EventMap['user.deleted']);

            const remaining = await AIConversation.find();
            assert.deepEqual(remaining.map((conversation) => conversation.id), [survivor.id]);
            assert.equal(await AIMessage.countBy({ conversationId: survivor.id }), 2);
        });

        it('deletes every conversation the user has across teams', async () => {
            const owner = await createUser('owner@volt.test');
            const team = await createTeam('one', owner);
            const otherTeam = await createTeam('two', owner);
            await seedConversation(team, owner);
            await seedConversation(otherTeam, owner);

            await events.deleteUserConversations({ userId: owner.id } as EventMap['user.deleted']);

            assert.equal(await AIConversation.count(), 0);
            assert.equal(await AIMessage.count(), 0);
        });
    });
});
