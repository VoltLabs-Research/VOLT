import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import ChatEvents from '@modules/chat/events/ChatEvents';
import Chat from '@modules/chat/models/Chat';
import ChatMessage from '@modules/chat/models/ChatMessage';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import { ChatMessageType } from '@volt/contracts/modules/chat/domain';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface Fixture{
    team: Team;
    otherTeam: Team;
    alice: User;
    bob: User;
}

const ENTITIES = [Chat, ChatMessage, Team, TeamMember, TeamRole, User];

describe('ChatEvents', () => {
    let dataSource: DataSource;
    const events = new ChatEvents();
    const published: EmittedEvent[] = [];

    before(async () => {
        dataSource = await createHarness(ENTITIES);
        eventBus.emit = async (name, payload) => {
            published.push({
                name,
                payload
            });
        };
        socketIOEmitter.emitToRoom = () => {};
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
    });

    const createFixture = async (): Promise<Fixture> => {
        const alice = await User.create({
            email: 'alice@volt.test',
            firstName: 'alice'
        }).save();
        const bob = await User.create({
            email: 'bob@volt.test',
            firstName: 'bob'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: alice.id
        }).save();
        const otherTeam = await Team.create({
            name: 'Team Two',
            owner: alice.id
        }).save();

        return {
            team,
            otherTeam,
            alice,
            bob
        };
    };

    const seedChat = (fixture: Fixture, overrides: Partial<Chat> = {}): Promise<Chat> => Chat.create({
        participants: [fixture.alice.id, fixture.bob.id],
        team: fixture.team.id,
        isActive: true,
        isGroup: false,
        ...overrides
    }).save();

    const seedMessage = (chatId: string, senderId: string): Promise<ChatMessage> => ChatMessage.create({
        chat: chatId,
        sender: senderId,
        content: 'hello',
        messageType: ChatMessageType.Text,
        readBy: [senderId],
        reactions: [],
        deleted: false
    }).save();

    describe('deleteChatMessages', () => {
        it('removes only the messages of the deleted chat', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const survivorChat = await seedChat(fixture);
            await seedMessage(chat.id, fixture.alice.id);
            await seedMessage(chat.id, fixture.bob.id);
            const survivor = await seedMessage(survivorChat.id, fixture.alice.id);

            await events.deleteChatMessages({
                chatId: chat.id,
                teamId: fixture.team.id
            });

            assert.equal(await ChatMessage.countBy({ chat: chat.id }), 0);
            assert.equal(await ChatMessage.countBy({ id: survivor.id }), 1);
        });

        it('resolves when the chat had no message', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            await events.deleteChatMessages({
                chatId: chat.id,
                teamId: fixture.team.id
            });

            assert.equal(await ChatMessage.count(), 0);
        });
    });

    describe('removeUserFromChats', () => {
        it('detaches the deleted user from the chats it took part in', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            await events.removeUserFromChats({ userId: fixture.bob.id });

            assert.deepEqual((await Chat.findOneBy({ id: chat.id }))?.participants, [fixture.alice.id]);
        });

        it('deletes the chats the deleted user was alone in', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture, { participants: [fixture.bob.id] });

            await events.removeUserFromChats({ userId: fixture.bob.id });

            assert.equal(await Chat.countBy({ id: chat.id }), 0);
            assert.deepEqual(published.map((event) => event.name), ['chat.deleted']);
        });
    });

    describe('deleteTeamChats', () => {
        it('removes every chat of the team', async () => {
            const fixture = await createFixture();
            const first = await seedChat(fixture);
            const second = await seedChat(fixture);

            await events.deleteTeamChats({ teamId: fixture.team.id });

            assert.equal(await Chat.countBy({ id: first.id }), 0);
            assert.equal(await Chat.countBy({ id: second.id }), 0);
        });

        it('keeps the chats of the other teams', async () => {
            const fixture = await createFixture();
            await seedChat(fixture);
            const survivor = await seedChat(fixture, { team: fixture.otherTeam.id });

            await events.deleteTeamChats({ teamId: fixture.team.id });

            assert.equal(await Chat.countBy({ id: survivor.id }), 1);
        });

        it('cascades to the messages of the deleted chats', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const survivorChat = await seedChat(fixture, { team: fixture.otherTeam.id });
            await seedMessage(chat.id, fixture.alice.id);
            const survivor = await seedMessage(survivorChat.id, fixture.alice.id);

            await events.deleteTeamChats({ teamId: fixture.team.id });

            assert.equal(await ChatMessage.countBy({ chat: chat.id }), 0);
            assert.equal(await ChatMessage.countBy({ id: survivor.id }), 1);
        });

        it('resolves when the team has no chat', async () => {
            const fixture = await createFixture();

            await events.deleteTeamChats({ teamId: fixture.otherTeam.id });

            assert.equal(await Chat.count(), 0);
        });
    });
});
