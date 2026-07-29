import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import ChatService from '@modules/chat/services/ChatService';
import Chat from '@modules/chat/models/Chat';
import ChatMessage from '@modules/chat/models/ChatMessage';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChatMessageType } from '@volt/contracts/modules/chat/domain';

interface EmittedEvent{
    name: string;
    payload: unknown;
}

interface RoomEmission{
    room: string;
    event: string;
    data: unknown;
}

interface Fixture{
    team: Team;
    otherTeam: Team;
    role: TeamRole;
    alice: User;
    bob: User;
    carol: User;
}

const ENTITIES = [Chat, ChatMessage, Team, TeamMember, TeamRole, User];

const onTheWire = <T>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T;

const isApplicationError = (code: string, statusCode: number) => (error: unknown): boolean => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    assert.equal(error.statusCode, statusCode);
    return true;
};

describe('ChatService', () => {
    let dataSource: DataSource;
    const service = new ChatService();
    const published: EmittedEvent[] = [];
    const emissions: RoomEmission[] = [];

    before(async () => {
        dataSource = await createHarness(ENTITIES);
        eventBus.emit = async (name, payload) => {
            published.push({
                name,
                payload
            });
        };
        socketIOEmitter.emitToRoom = (room, event, data) => {
            emissions.push({
                room,
                event,
                data
            });
        };
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        published.length = 0;
        emissions.length = 0;
    });

    const createUser = (email: string, firstName = 'ada'): Promise<User> => User.create({
        email,
        firstName
    }).save();

    const createFixture = async (): Promise<Fixture> => {
        const alice = await createUser('alice@volt.test', 'alice');
        const bob = await createUser('bob@volt.test', 'bob');
        const carol = await createUser('carol@volt.test', 'carol');
        const team = await Team.create({
            name: 'Team One',
            owner: alice.id
        }).save();
        const otherTeam = await Team.create({
            name: 'Team Two',
            owner: alice.id
        }).save();
        const role = await TeamRole.create({
            team: team.id,
            name: 'member',
            permissions: []
        }).save();

        for(const user of [alice, bob, carol]){
            await TeamMember.create({
                team: team.id,
                user: user.id,
                role: role.id
            }).save();
        }

        return {
            team,
            otherTeam,
            role,
            alice,
            bob,
            carol
        };
    };

    const seedChat = (fixture: Fixture, overrides: Partial<Chat> = {}): Promise<Chat> => Chat.create({
        participants: [fixture.alice.id, fixture.bob.id],
        team: fixture.team.id,
        isActive: true,
        isGroup: false,
        ...overrides
    }).save();

    const seedGroup = (fixture: Fixture, overrides: Partial<Chat> = {}): Promise<Chat> => Chat.create({
        participants: [fixture.alice.id, fixture.bob.id, fixture.carol.id],
        team: fixture.team.id,
        isActive: true,
        isGroup: true,
        groupName: 'Lab',
        groupDescription: 'notes',
        admins: [fixture.alice.id],
        createdBy: fixture.alice.id,
        ...overrides
    }).save();

    const seedMessage = (chatId: string, senderId: string, overrides: Partial<ChatMessage> = {}): Promise<ChatMessage> => ChatMessage.create({
        chat: chatId,
        sender: senderId,
        content: 'hello',
        messageType: ChatMessageType.Text,
        readBy: [senderId],
        reactions: [],
        deleted: false,
        ...overrides
    }).save();

    const rawColumn = async (table: string, column: string, id: string): Promise<unknown> => {
        const rows = await dataSource.query(`SELECT "${column}" AS value FROM "${table}" WHERE "id" = ?`, [id]);
        return (rows as Array<{ value: unknown }>)[0].value;
    };

    describe('member lookup over a simple-array column', () => {
        it('does not match a user id that is only a prefix of a participant', async () => {
            const fixture = await createFixture();
            const prefixed = await createUser('prefix@volt.test');
            await Chat.update({ id: (await seedChat(fixture)).id }, { participants: [`${prefixed.id}extra`, fixture.bob.id] });

            const chats = await service.getUserChats(prefixed.id);

            assert.deepEqual(chats, []);
        });

        it('does not match a user id that another participant id starts with', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            await Chat.update({ id: chat.id }, { participants: [`${fixture.alice.id}9`, fixture.bob.id] });

            const forAlice = await service.getUserChats(fixture.alice.id);
            const forBob = await service.getUserChats(fixture.bob.id);

            assert.deepEqual(forAlice, []);
            assert.equal(forBob.length, 1);
        });

        it('treats a percent sign in the requested id as a literal and not as a wildcard', async () => {
            const fixture = await createFixture();
            await seedChat(fixture);

            const chats = await service.getUserChats('%');

            assert.deepEqual(chats, []);
        });

        it('treats an underscore in the requested id as a literal and not as a single character wildcard', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const wildcard = `${fixture.alice.id.slice(0, 23)}_`;
            await Chat.update({ id: chat.id }, { participants: [fixture.alice.id] });

            const chats = await service.getUserChats(wildcard);

            assert.deepEqual(chats, []);
        });

        it('finds the participant that sits at the head, the middle and the tail of the array', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            await Chat.update({ id: chat.id }, { participants: [fixture.alice.id, fixture.bob.id, fixture.carol.id] });

            for(const user of [fixture.alice, fixture.bob, fixture.carol]){
                assert.equal((await service.getUserChats(user.id)).length, 1);
            }
        });

        it('ignores a chat whose participants column is null', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture, { participants: null });

            const chats = await service.getUserChats(fixture.alice.id);

            assert.deepEqual(chats, []);
            assert.equal(await rawColumn('chats', 'participants', chat.id), null);
        });
    });

    describe('simple-array persistence', () => {
        it('stores an empty participant list as an empty string and a missing one as null', async () => {
            const fixture = await createFixture();
            const empty = await seedChat(fixture, { participants: [] });
            const missing = await seedChat(fixture, { participants: null });

            assert.equal(await rawColumn('chats', 'participants', empty.id), '');
            assert.equal(await rawColumn('chats', 'participants', missing.id), null);
        });

        it('round trips an empty list back to an array and a null back to null', async () => {
            const fixture = await createFixture();
            const empty = await seedChat(fixture, { participants: [] });
            const missing = await seedChat(fixture, { participants: null });

            assert.deepEqual((await Chat.findOneBy({ id: empty.id }))?.participants, []);
            assert.equal((await Chat.findOneBy({ id: missing.id }))?.participants, null);
        });

        it('round trips the admin list of a group intact', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, { admins: [fixture.alice.id, fixture.carol.id] });

            assert.deepEqual((await Chat.findOneBy({ id: group.id }))?.admins, [fixture.alice.id, fixture.carol.id]);
        });

        it('round trips the readBy list of a message intact', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id, { readBy: [fixture.alice.id, fixture.bob.id] });

            assert.deepEqual((await ChatMessage.findOneBy({ id: message.id }))?.readBy, [fixture.alice.id, fixture.bob.id]);
        });
    });

    describe('getUserChats', () => {
        it('returns the active chats of the participant newest message first', async () => {
            const fixture = await createFixture();
            const older = await seedChat(fixture);
            const newer = await seedChat(fixture);
            await Chat.update({ id: older.id }, { lastMessageAt: new Date('2024-01-01T00:00:00.000Z') });
            await Chat.update({ id: newer.id }, { lastMessageAt: new Date('2024-06-01T00:00:00.000Z') });

            const chats = await service.getUserChats(fixture.alice.id);

            assert.deepEqual(chats.map((chat) => chat._id), [newer.id, older.id]);
        });

        it('sorts the chats without any message last', async () => {
            const fixture = await createFixture();
            const never = await seedChat(fixture);
            const talked = await seedChat(fixture);
            await Chat.update({ id: talked.id }, { lastMessageAt: new Date('2024-01-01T00:00:00.000Z') });

            const chats = await service.getUserChats(fixture.alice.id);

            assert.deepEqual(chats.map((chat) => chat._id), [talked.id, never.id]);
        });

        it('excludes the inactive chats', async () => {
            const fixture = await createFixture();
            await seedChat(fixture, { isActive: false });

            assert.deepEqual(await service.getUserChats(fixture.alice.id), []);
        });

        it('resolves the participant ids into user records without leaking the password', async () => {
            const fixture = await createFixture();
            await User.update({ id: fixture.alice.id }, { password: 'hashed-secret' });
            await seedChat(fixture);

            const chats = onTheWire<Array<{ participants: Array<Record<string, unknown>> }>>(
                await service.getUserChats(fixture.alice.id)
            );

            assert.deepEqual(chats[0].participants.map((participant) => participant._id), [fixture.alice.id, fixture.bob.id]);
            assert.equal(chats[0].participants[0].email, 'alice@volt.test');
            assert.equal('password' in chats[0].participants[0], false);
        });

        it('drops the participant ids that no longer resolve to a user', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            await Chat.update({ id: chat.id }, { participants: [fixture.alice.id, 'f'.repeat(24)] });

            const chats = await service.getUserChats(fixture.alice.id);
            const participants = chats[0].participants as User[];

            assert.deepEqual(participants.map((participant) => participant.id), [fixture.alice.id]);
        });

        it('embeds the last message of the chat', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.bob.id, { content: 'the latest' });
            await Chat.update({ id: chat.id }, { lastMessage: message.id });

            const chats = onTheWire<Array<{ lastMessage: { _id: string; content: string } }>>(
                await service.getUserChats(fixture.alice.id)
            );

            assert.equal(chats[0].lastMessage._id, message.id);
            assert.equal(chats[0].lastMessage.content, 'the latest');
        });

        it('degrades a dangling lastMessage reference to null because the column has no foreign key', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.bob.id);
            await Chat.update({ id: chat.id }, { lastMessage: message.id });
            await ChatMessage.delete({ id: message.id });

            const chats = await service.getUserChats(fixture.alice.id);

            assert.equal(await rawColumn('chats', 'lastMessage', chat.id), message.id);
            assert.equal(chats[0].lastMessage, null);
        });

        it('reports a null lastMessage when the chat never had one', async () => {
            const fixture = await createFixture();
            await seedChat(fixture);

            const chats = await service.getUserChats(fixture.alice.id);

            assert.equal(chats[0].lastMessage, null);
        });

        it('exposes the chat id on the wire as _id and not as id', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            const chats = await service.getUserChats(fixture.alice.id);

            assert.equal(chats[0]._id, chat.id);
            assert.equal('id' in chats[0], false);
        });

        it('keeps the team reference as an id string when it is not loaded', async () => {
            const fixture = await createFixture();
            await seedChat(fixture);

            const chats = await service.getUserChats(fixture.alice.id);

            assert.equal(chats[0].team, fixture.team.id);
        });
    });

    describe('getOrCreateChat', () => {
        it('creates a direct chat between two members of the team', async () => {
            const fixture = await createFixture();

            const chat = await service.getOrCreateChat(fixture.alice.id, fixture.bob.id, fixture.team.id);

            const stored = await Chat.findOneBy({ id: chat._id as string });
            assert.deepEqual(stored?.participants, [fixture.alice.id, fixture.bob.id]);
            assert.equal(stored?.isGroup, false);
            assert.equal(stored?.isActive, true);
            assert.equal(stored?.team, fixture.team.id);
        });

        it('returns the existing direct chat instead of creating a second one', async () => {
            const fixture = await createFixture();
            const existing = await seedChat(fixture);

            const chat = await service.getOrCreateChat(fixture.bob.id, fixture.alice.id, fixture.team.id);

            assert.equal(chat._id, existing.id);
            assert.equal(await Chat.count(), 1);
        });

        it('does not reuse the direct chat of another team', async () => {
            const fixture = await createFixture();
            await seedChat(fixture, { team: fixture.otherTeam.id });

            await service.getOrCreateChat(fixture.alice.id, fixture.bob.id, fixture.team.id);

            assert.equal(await Chat.countBy({ team: fixture.team.id }), 1);
        });

        it('does not reuse a group chat as a direct chat', async () => {
            const fixture = await createFixture();
            await seedGroup(fixture);

            const chat = await service.getOrCreateChat(fixture.alice.id, fixture.bob.id, fixture.team.id);

            assert.equal((await Chat.findOneBy({ id: chat._id as string }))?.isGroup, false);
            assert.equal(await Chat.count(), 2);
        });

        it('resolves the participants of the returned chat', async () => {
            const fixture = await createFixture();

            const chat = onTheWire<{ participants: Array<{ _id: string }> }>(
                await service.getOrCreateChat(fixture.alice.id, fixture.bob.id, fixture.team.id)
            );

            assert.deepEqual(chat.participants.map((participant) => participant._id), [fixture.alice.id, fixture.bob.id]);
        });

        it('rejects a chat with yourself', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.getOrCreateChat(fixture.alice.id, fixture.alice.id, fixture.team.id),
                isApplicationError('Chat::InvalidAction', 400)
            );
        });
    });

    describe('createGroupChat', () => {
        it('creates the group with the creator as the only admin', async () => {
            const fixture = await createFixture();

            const chat = await service.createGroupChat(fixture.alice.id, {
                teamId: fixture.team.id,
                groupName: 'Lab',
                groupDescription: 'notes',
                participantIds: [fixture.bob.id, fixture.carol.id]
            });

            const stored = await Chat.findOneBy({ id: chat._id as string });
            assert.equal(stored?.isGroup, true);
            assert.equal(stored?.groupName, 'Lab');
            assert.equal(stored?.groupDescription, 'notes');
            assert.deepEqual(stored?.admins, [fixture.alice.id]);
            assert.deepEqual(stored?.participants, [fixture.alice.id, fixture.bob.id, fixture.carol.id]);
        });

        it('records the creator so the group invariant is enforced by the service', async () => {
            const fixture = await createFixture();

            const chat = await service.createGroupChat(fixture.alice.id, {
                teamId: fixture.team.id,
                groupName: 'Lab',
                participantIds: [fixture.bob.id]
            });

            assert.equal((await Chat.findOneBy({ id: chat._id as string }))?.createdBy, fixture.alice.id);
        });

        it('lets the schema store a group without a creator, so only the service guards the invariant', async () => {
            const fixture = await createFixture();

            const orphan = await seedGroup(fixture, { createdBy: null });

            assert.equal((await Chat.findOneBy({ id: orphan.id }))?.createdBy, null);
        });

        it('refuses to create a group chat without a creator', async () => {
            const fixture = await createFixture();
            await dataSource.query('INSERT INTO "users" ("id", "email", "firstName") VALUES (?, ?, ?)', ['', 'anonymous@volt.test', 'anon']);
            await TeamMember.create({
                team: fixture.team.id,
                user: '',
                role: fixture.role.id
            }).save();

            await assert.rejects(
                () => service.createGroupChat('', {
                    teamId: fixture.team.id,
                    groupName: 'Lab',
                    participantIds: [fixture.bob.id]
                }),
                isApplicationError('Validation::MissingRequiredFields', 400)
            );
            assert.equal(await Chat.count(), 0);
        });

        it('reports a missing creator as a membership failure when it is not a team member', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.createGroupChat('', {
                    teamId: fixture.team.id,
                    groupName: 'Lab',
                    participantIds: [fixture.bob.id]
                }),
                isApplicationError('TeamMember::NotFound', 404)
            );
            assert.equal(await Chat.count(), 0);
        });

        it('deduplicates the creator when it is also listed as a participant', async () => {
            const fixture = await createFixture();

            const chat = await service.createGroupChat(fixture.alice.id, {
                teamId: fixture.team.id,
                groupName: 'Lab',
                participantIds: [fixture.alice.id, fixture.bob.id]
            });

            assert.deepEqual((await Chat.findOneBy({ id: chat._id as string }))?.participants, [fixture.alice.id, fixture.bob.id]);
        });

        it('rejects an unknown team', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.createGroupChat(fixture.alice.id, {
                    teamId: 'a'.repeat(24),
                    groupName: 'Lab',
                    participantIds: [fixture.bob.id]
                }),
                isApplicationError('Team::NotFound', 404)
            );
        });

        it('rejects a participant that does not belong to the team', async () => {
            const fixture = await createFixture();
            const outsider = await createUser('outsider@volt.test');

            await assert.rejects(
                () => service.createGroupChat(fixture.alice.id, {
                    teamId: fixture.team.id,
                    groupName: 'Lab',
                    participantIds: [outsider.id]
                }),
                isApplicationError('TeamMember::NotFound', 404)
            );
            assert.equal(await Chat.count(), 0);
        });

        it('notifies every participant of the new group', async () => {
            const fixture = await createFixture();

            await service.createGroupChat(fixture.alice.id, {
                teamId: fixture.team.id,
                groupName: 'Lab',
                participantIds: [fixture.bob.id, fixture.carol.id]
            });

            assert.deepEqual(
                emissions.map((emission) => emission.room),
                [`user-${fixture.alice.id}`, `user-${fixture.bob.id}`, `user-${fixture.carol.id}`]
            );
            assert.deepEqual(new Set(emissions.map((emission) => emission.event)), new Set(['group_created']));
        });
    });

    describe('addUsersToGroup', () => {
        it('appends the new members without duplicating the existing ones', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, { participants: [fixture.alice.id, fixture.bob.id] });

            await service.addUsersToGroup(fixture.alice.id, group.id, [fixture.bob.id, fixture.carol.id]);

            assert.deepEqual(
                (await Chat.findOneBy({ id: group.id }))?.participants,
                [fixture.alice.id, fixture.bob.id, fixture.carol.id]
            );
        });

        it('rejects a user that does not belong to the team', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture);
            const outsider = await createUser('outsider@volt.test');

            await assert.rejects(
                () => service.addUsersToGroup(fixture.alice.id, group.id, [outsider.id]),
                isApplicationError('TeamMember::NotFound', 404)
            );
        });

        it('rejects a requester that is not an admin', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture);

            await assert.rejects(
                () => service.addUsersToGroup(fixture.bob.id, group.id, [fixture.carol.id]),
                isApplicationError('Auth::Unauthorized', 401)
            );
        });

        it('rejects a requester that is not a participant', async () => {
            const fixture = await createFixture();
            const outsider = await createUser('outsider@volt.test');
            const group = await seedGroup(fixture);

            await assert.rejects(
                () => service.addUsersToGroup(outsider.id, group.id, [fixture.carol.id]),
                isApplicationError('Auth::Unauthorized', 401)
            );
        });

        it('rejects a direct chat', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            await assert.rejects(
                () => service.addUsersToGroup(fixture.alice.id, chat.id, [fixture.carol.id]),
                isApplicationError('Chat::NotFound', 404)
            );
        });

        it('rejects an unknown chat', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.addUsersToGroup(fixture.alice.id, 'a'.repeat(24), [fixture.carol.id]),
                isApplicationError('Chat::NotFound', 404)
            );
        });
    });

    describe('removeUsersFromGroup', () => {
        it('removes the members and revokes their admin rights', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, { admins: [fixture.alice.id, fixture.carol.id] });

            await service.removeUsersFromGroup(fixture.alice.id, group.id, [fixture.carol.id]);

            const stored = await Chat.findOneBy({ id: group.id });
            assert.deepEqual(stored?.participants, [fixture.alice.id, fixture.bob.id]);
            assert.deepEqual(stored?.admins, [fixture.alice.id]);
        });

        it('refuses to leave the group with fewer than two members', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, { participants: [fixture.alice.id, fixture.bob.id] });

            await assert.rejects(
                () => service.removeUsersFromGroup(fixture.alice.id, group.id, [fixture.bob.id]),
                isApplicationError('Chat::Group::MinParticipants', 400)
            );
            assert.deepEqual((await Chat.findOneBy({ id: group.id }))?.participants, [fixture.alice.id, fixture.bob.id]);
        });

        it('rejects a requester that is not an admin', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture);

            await assert.rejects(
                () => service.removeUsersFromGroup(fixture.bob.id, group.id, [fixture.carol.id]),
                isApplicationError('Auth::Unauthorized', 401)
            );
        });
    });

    describe('updateGroupInfo', () => {
        it('renames the group and rewrites its description', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture);

            const updated = await service.updateGroupInfo(fixture.alice.id, group.id, {
                groupName: 'Renamed',
                groupDescription: 'fresh'
            });

            assert.equal(updated.groupName, 'Renamed');
            const stored = await Chat.findOneBy({ id: group.id });
            assert.equal(stored?.groupName, 'Renamed');
            assert.equal(stored?.groupDescription, 'fresh');
        });

        it('keeps the current values when the input carries no field', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture);

            await service.updateGroupInfo(fixture.alice.id, group.id, {});

            const stored = await Chat.findOneBy({ id: group.id });
            assert.equal(stored?.groupName, 'Lab');
            assert.equal(stored?.groupDescription, 'notes');
        });

        it('rejects a requester that is not an admin', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture);

            await assert.rejects(
                () => service.updateGroupInfo(fixture.bob.id, group.id, { groupName: 'Renamed' }),
                isApplicationError('Auth::Unauthorized', 401)
            );
        });
    });

    describe('updateGroupAdmins', () => {
        it('promotes a participant to admin', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture);

            await service.updateGroupAdmins(fixture.alice.id, group.id, {
                action: 'add',
                targetUserIds: [fixture.bob.id]
            });

            assert.deepEqual((await Chat.findOneBy({ id: group.id }))?.admins, [fixture.alice.id, fixture.bob.id]);
        });

        it('does not duplicate an admin that was already promoted', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, { admins: [fixture.alice.id, fixture.bob.id] });

            await service.updateGroupAdmins(fixture.alice.id, group.id, {
                action: 'add',
                targetUserIds: [fixture.bob.id]
            });

            assert.deepEqual((await Chat.findOneBy({ id: group.id }))?.admins, [fixture.alice.id, fixture.bob.id]);
        });

        it('demotes an admin', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, { admins: [fixture.alice.id, fixture.bob.id] });

            await service.updateGroupAdmins(fixture.alice.id, group.id, {
                action: 'remove',
                targetUserIds: [fixture.bob.id]
            });

            assert.deepEqual((await Chat.findOneBy({ id: group.id }))?.admins, [fixture.alice.id]);
        });

        it('refuses to leave the group without any admin', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture);

            await assert.rejects(
                () => service.updateGroupAdmins(fixture.alice.id, group.id, {
                    action: 'remove',
                    targetUserIds: [fixture.alice.id]
                }),
                isApplicationError('Chat::Group::MinAdmins', 400)
            );
            assert.deepEqual((await Chat.findOneBy({ id: group.id }))?.admins, [fixture.alice.id]);
        });

        it('rejects a target that is not a participant of the group', async () => {
            const fixture = await createFixture();
            const outsider = await createUser('outsider@volt.test');
            const group = await seedGroup(fixture);

            await assert.rejects(
                () => service.updateGroupAdmins(fixture.alice.id, group.id, {
                    action: 'add',
                    targetUserIds: [outsider.id]
                }),
                isApplicationError('Chat::Users::NotInTeam', 400)
            );
        });

        it('rejects an unknown action', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture);

            await assert.rejects(
                () => service.updateGroupAdmins(fixture.alice.id, group.id, {
                    action: 'promote' as 'add',
                    targetUserIds: [fixture.bob.id]
                }),
                isApplicationError('Chat::InvalidAction', 400)
            );
        });
    });

    describe('leaveGroup', () => {
        it('removes the member from the participants and the admins', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, { admins: [fixture.alice.id, fixture.bob.id] });

            await service.leaveGroup(fixture.bob.id, group.id);

            const stored = await Chat.findOneBy({ id: group.id });
            assert.deepEqual(stored?.participants, [fixture.alice.id, fixture.carol.id]);
            assert.deepEqual(stored?.admins, [fixture.alice.id]);
            assert.equal(stored?.isActive, true);
        });

        it('hands the group back to its creator when the last admin leaves', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, {
                admins: [fixture.bob.id],
                createdBy: fixture.alice.id
            });

            await service.leaveGroup(fixture.bob.id, group.id);

            assert.deepEqual((await Chat.findOneBy({ id: group.id }))?.admins, [fixture.alice.id]);
        });

        it('leaves the group without admins when the last admin leaves and the creator is gone', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, {
                admins: [fixture.bob.id],
                createdBy: null
            });

            await service.leaveGroup(fixture.bob.id, group.id);

            assert.deepEqual((await Chat.findOneBy({ id: group.id }))?.admins, []);
        });

        it('deactivates the group when fewer than two members remain', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, { participants: [fixture.alice.id, fixture.bob.id] });

            await service.leaveGroup(fixture.bob.id, group.id);

            assert.equal((await Chat.findOneBy({ id: group.id }))?.isActive, false);
        });

        it('does not require the leaving member to be an admin', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture);

            await service.leaveGroup(fixture.carol.id, group.id);

            assert.deepEqual((await Chat.findOneBy({ id: group.id }))?.participants, [fixture.alice.id, fixture.bob.id]);
        });
    });

    describe('getChatMessages', () => {
        it('returns the messages of the chat oldest first with the sender loaded', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const first = await seedMessage(chat.id, fixture.alice.id, { content: 'one' });
            const second = await seedMessage(chat.id, fixture.bob.id, { content: 'two' });
            await ChatMessage.update({ id: first.id }, { createdAt: new Date('2024-01-01T00:00:00.000Z') });
            await ChatMessage.update({ id: second.id }, { createdAt: new Date('2024-06-01T00:00:00.000Z') });

            const page = await service.getChatMessages(fixture.alice.id, chat.id, {});
            const messages = onTheWire<Array<{ content: string; sender: { _id: string; email: string } }>>(page.data);

            assert.deepEqual(messages.map((message) => message.content), ['one', 'two']);
            assert.equal(messages[0].sender._id, fixture.alice.id);
            assert.equal(messages[0].sender.email, 'alice@volt.test');
        });

        it('defaults to a page of one hundred messages', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            await seedMessage(chat.id, fixture.alice.id);

            const page = await service.getChatMessages(fixture.alice.id, chat.id, {});

            assert.equal(page.limit, 100);
            assert.equal(page.page, 1);
            assert.equal(page.total, 1);
            assert.equal(page.totalPages, 1);
        });

        it('caps the requested limit at five hundred', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            const page = await service.getChatMessages(fixture.alice.id, chat.id, { limit: 5000 });

            assert.equal(page.limit, 500);
        });

        it('paginates while reporting the unpaged total', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            for(const content of ['a', 'b', 'c']){
                await seedMessage(chat.id, fixture.alice.id, { content });
            }

            const page = await service.getChatMessages(fixture.alice.id, chat.id, {
                page: 2,
                limit: 2
            });

            assert.equal(page.total, 3);
            assert.equal(page.totalPages, 2);
            assert.equal(page.data.length, 1);
        });

        it('excludes the messages of another chat', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const other = await seedChat(fixture);
            await seedMessage(chat.id, fixture.alice.id);
            await seedMessage(other.id, fixture.alice.id);

            const page = await service.getChatMessages(fixture.alice.id, chat.id, {});

            assert.equal(page.total, 1);
        });

        it('rejects a requester that is not a participant', async () => {
            const fixture = await createFixture();
            const outsider = await createUser('outsider@volt.test');
            const chat = await seedChat(fixture);

            await assert.rejects(
                () => service.getChatMessages(outsider.id, chat.id, {}),
                isApplicationError('Auth::Unauthorized', 401)
            );
        });

        it('rejects an inactive chat', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture, { isActive: false });

            await assert.rejects(
                () => service.getChatMessages(fixture.alice.id, chat.id, {}),
                isApplicationError('Chat::NotFound', 404)
            );
        });
    });

    describe('sendChatMessage', () => {
        it('persists the message and marks it read by its sender', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            const message = await service.sendChatMessage(fixture.alice.id, chat.id, {
                content: 'hello there',
                messageType: ChatMessageType.Text
            });

            const stored = await ChatMessage.findOneBy({ id: message._id as string });
            assert.equal(stored?.content, 'hello there');
            assert.equal(stored?.messageType, ChatMessageType.Text);
            assert.equal(stored?.sender, fixture.alice.id);
            assert.deepEqual(stored?.readBy, [fixture.alice.id]);
            assert.deepEqual(stored?.reactions, []);
            assert.equal(stored?.deleted, false);
        });

        it('points the chat at the new message', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            const message = await service.sendChatMessage(fixture.alice.id, chat.id, {
                content: 'hello there',
                messageType: ChatMessageType.Text
            });

            const stored = await Chat.findOneBy({ id: chat.id });
            assert.equal(stored?.lastMessage, message._id);
            assert.ok(stored?.lastMessageAt instanceof Date);
        });

        it('returns the message with its sender embedded', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            const message = onTheWire<{ sender: { _id: string; email: string } }>(
                await service.sendChatMessage(fixture.alice.id, chat.id, {
                    content: 'hello there',
                    messageType: ChatMessageType.Text
                })
            );

            assert.equal(message.sender._id, fixture.alice.id);
            assert.equal(message.sender.email, 'alice@volt.test');
        });

        it('broadcasts the message to the chat room', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            await service.sendChatMessage(fixture.alice.id, chat.id, {
                content: 'hello there',
                messageType: ChatMessageType.Text
            });

            assert.deepEqual(
                emissions.map((emission) => [emission.room, emission.event]),
                [[`chat-${chat.id}`, 'new_message']]
            );
        });

        it('rejects a requester that is not a participant', async () => {
            const fixture = await createFixture();
            const outsider = await createUser('outsider@volt.test');
            const chat = await seedChat(fixture);

            await assert.rejects(
                () => service.sendChatMessage(outsider.id, chat.id, {
                    content: 'hello there',
                    messageType: ChatMessageType.Text
                }),
                isApplicationError('Auth::Unauthorized', 401)
            );
            assert.equal(await ChatMessage.count(), 0);
        });
    });

    describe('sendFileMessage', () => {
        it('stores the upload metadata as a simple-json payload', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            const message = await service.sendFileMessage(fixture.alice.id, chat.id, {
                filename: 'stored-name.pdf',
                originalName: 'report.pdf',
                size: 2048,
                mimetype: 'application/pdf',
                url: '/files/stored-name.pdf'
            });

            const stored = await ChatMessage.findOneBy({ id: message._id as string });
            assert.equal(stored?.content, 'report.pdf');
            assert.equal(stored?.messageType, ChatMessageType.File);
            assert.deepEqual(stored?.metadata, {
                fileName: 'report.pdf',
                fileSize: 2048,
                fileType: 'application/pdf',
                fileUrl: '/files/stored-name.pdf',
                filePath: 'stored-name.pdf'
            });
        });
    });

    describe('editMessage', () => {
        it('rewrites the content of the message', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);

            const edited = await service.editMessage(fixture.alice.id, chat.id, message.id, 'corrected');

            assert.equal(edited.content, 'corrected');
            assert.equal((await ChatMessage.findOneBy({ id: message.id }))?.content, 'corrected');
        });

        it('rejects a user that does not own the message', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);

            await assert.rejects(
                () => service.editMessage(fixture.bob.id, chat.id, message.id, 'corrected'),
                isApplicationError('Message:Forbidden', 403)
            );
            assert.equal((await ChatMessage.findOneBy({ id: message.id }))?.content, 'hello');
        });

        it('rejects an unknown message', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            await assert.rejects(
                () => service.editMessage(fixture.alice.id, chat.id, 'a'.repeat(24), 'corrected'),
                isApplicationError('Message::NotFound', 404)
            );
        });
    });

    describe('deleteMessage', () => {
        it('soft deletes the message and keeps the row', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);

            await service.deleteMessage(fixture.alice.id, chat.id, message.id);

            const stored = await ChatMessage.findOneBy({ id: message.id });
            assert.equal(stored?.deleted, true);
            assert.equal(stored?.content, 'hello');
        });

        it('rejects a user that does not own the message', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);

            await assert.rejects(
                () => service.deleteMessage(fixture.bob.id, chat.id, message.id),
                isApplicationError('Message:Forbidden', 403)
            );
            assert.equal((await ChatMessage.findOneBy({ id: message.id }))?.deleted, false);
        });

        it('rejects an unknown message', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            await assert.rejects(
                () => service.deleteMessage(fixture.alice.id, chat.id, 'a'.repeat(24)),
                isApplicationError('Message::NotFound', 404)
            );
        });
    });

    describe('markMessagesAsRead', () => {
        it('appends the reader to every unread message of the chat', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const first = await seedMessage(chat.id, fixture.alice.id);
            const second = await seedMessage(chat.id, fixture.alice.id);

            await service.markMessagesAsRead(fixture.bob.id, chat.id);

            assert.deepEqual((await ChatMessage.findOneBy({ id: first.id }))?.readBy, [fixture.alice.id, fixture.bob.id]);
            assert.deepEqual((await ChatMessage.findOneBy({ id: second.id }))?.readBy, [fixture.alice.id, fixture.bob.id]);
        });

        it('does not add the reader twice', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id, { readBy: [fixture.alice.id, fixture.bob.id] });

            await service.markMessagesAsRead(fixture.bob.id, chat.id);

            assert.deepEqual((await ChatMessage.findOneBy({ id: message.id }))?.readBy, [fixture.alice.id, fixture.bob.id]);
        });

        it('seeds the readBy list of a message that had none', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id, { readBy: null });

            await service.markMessagesAsRead(fixture.bob.id, chat.id);

            assert.deepEqual((await ChatMessage.findOneBy({ id: message.id }))?.readBy, [fixture.bob.id]);
        });

        it('leaves the messages of another chat untouched', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const other = await seedChat(fixture);
            const foreign = await seedMessage(other.id, fixture.alice.id);

            await service.markMessagesAsRead(fixture.bob.id, chat.id);

            assert.deepEqual((await ChatMessage.findOneBy({ id: foreign.id }))?.readBy, [fixture.alice.id]);
        });
    });

    describe('reactions', () => {
        it('stores the reaction of a user on a message', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);

            await service.setMessageReaction(fixture.bob.id, chat.id, message.id, 'thumbsup');

            assert.deepEqual((await ChatMessage.findOneBy({ id: message.id }))?.reactions, [{
                emoji: 'thumbsup',
                users: [fixture.bob.id]
            }]);
        });

        it('moves a user from its previous reaction to the new one', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);

            await service.setMessageReaction(fixture.bob.id, chat.id, message.id, 'thumbsup');
            await service.setMessageReaction(fixture.bob.id, chat.id, message.id, 'heart');

            assert.deepEqual((await ChatMessage.findOneBy({ id: message.id }))?.reactions, [{
                emoji: 'heart',
                users: [fixture.bob.id]
            }]);
        });

        it('groups two users under the same emoji', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);

            await service.setMessageReaction(fixture.alice.id, chat.id, message.id, 'thumbsup');
            await service.setMessageReaction(fixture.bob.id, chat.id, message.id, 'thumbsup');

            assert.deepEqual((await ChatMessage.findOneBy({ id: message.id }))?.reactions, [{
                emoji: 'thumbsup',
                users: [fixture.alice.id, fixture.bob.id]
            }]);
        });

        it('drops the emoji entry once its last user is removed', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);
            await service.setMessageReaction(fixture.bob.id, chat.id, message.id, 'thumbsup');

            await service.removeMessageReaction(fixture.bob.id, chat.id, message.id, 'thumbsup');

            assert.deepEqual((await ChatMessage.findOneBy({ id: message.id }))?.reactions, []);
        });

        it('keeps the emoji entry when another user still reacted with it', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);
            await service.setMessageReaction(fixture.alice.id, chat.id, message.id, 'thumbsup');
            await service.setMessageReaction(fixture.bob.id, chat.id, message.id, 'thumbsup');

            await service.removeMessageReaction(fixture.bob.id, chat.id, message.id, 'thumbsup');

            assert.deepEqual((await ChatMessage.findOneBy({ id: message.id }))?.reactions, [{
                emoji: 'thumbsup',
                users: [fixture.alice.id]
            }]);
        });

        it('ignores the removal of an emoji the user never reacted with', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);
            await service.setMessageReaction(fixture.alice.id, chat.id, message.id, 'thumbsup');

            await service.removeMessageReaction(fixture.bob.id, chat.id, message.id, 'thumbsup');

            assert.deepEqual((await ChatMessage.findOneBy({ id: message.id }))?.reactions, [{
                emoji: 'thumbsup',
                users: [fixture.alice.id]
            }]);
        });

        it('rejects a reaction on an unknown message', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            await assert.rejects(
                () => service.setMessageReaction(fixture.alice.id, chat.id, 'a'.repeat(24), 'thumbsup'),
                isApplicationError('Message::NotFound', 404)
            );
        });

        it('rejects a reaction from a user outside the chat of the message', async () => {
            const fixture = await createFixture();
            const outsider = await createUser('outsider@volt.test');
            const chat = await seedChat(fixture);
            const message = await seedMessage(chat.id, fixture.alice.id);

            await assert.rejects(
                () => service.setMessageReaction(outsider.id, chat.id, message.id, 'thumbsup'),
                isApplicationError('Auth::Unauthorized', 401)
            );
        });
    });

    describe('resolveAccessibleChatTeamId', () => {
        it('returns the team of an accessible chat', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);

            assert.equal(await service.resolveAccessibleChatTeamId(chat.id, fixture.alice.id), fixture.team.id);
        });

        it('rejects a chat the user does not participate in', async () => {
            const fixture = await createFixture();
            const outsider = await createUser('outsider@volt.test');
            const chat = await seedChat(fixture);

            await assert.rejects(
                () => service.resolveAccessibleChatTeamId(chat.id, outsider.id),
                isApplicationError('Auth::Unauthorized', 401)
            );
        });

        it('rejects an unknown chat', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.resolveAccessibleChatTeamId('a'.repeat(24), fixture.alice.id),
                isApplicationError('Chat::NotFound', 404)
            );
        });
    });

    describe('removeUserFromAllChats', () => {
        it('detaches the user from the participants and the admins of every chat', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, { admins: [fixture.alice.id, fixture.bob.id] });

            await service.removeUserFromAllChats(fixture.bob.id);

            const stored = await Chat.findOneBy({ id: group.id });
            assert.deepEqual(stored?.participants, [fixture.alice.id, fixture.carol.id]);
            assert.deepEqual(stored?.admins, [fixture.alice.id]);
        });

        it('detaches a user that is only an admin of the chat', async () => {
            const fixture = await createFixture();
            const group = await seedGroup(fixture, {
                participants: [fixture.alice.id, fixture.carol.id],
                admins: [fixture.bob.id]
            });

            await service.removeUserFromAllChats(fixture.bob.id);

            assert.deepEqual((await Chat.findOneBy({ id: group.id }))?.admins, []);
        });

        it('deletes the chat that becomes an empty participant string', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture, { participants: [fixture.bob.id] });

            await service.removeUserFromAllChats(fixture.bob.id);

            assert.equal(await Chat.countBy({ id: chat.id }), 0);
            assert.deepEqual(
                published.map((event) => [event.name, (event.payload as { chatId: string }).chatId]),
                [['chat.deleted', chat.id]]
            );
        });

        it('deletes the chat whose participants column is null', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture, { participants: null });

            await service.removeUserFromAllChats(fixture.bob.id);

            assert.equal(await Chat.countBy({ id: chat.id }), 0);
            assert.deepEqual(
                published.map((event) => [event.name, (event.payload as { chatId: string }).chatId]),
                [['chat.deleted', chat.id]]
            );
        });

        it('keeps the chats that still have participants', async () => {
            const fixture = await createFixture();
            const survivor = await seedChat(fixture);

            await service.removeUserFromAllChats(fixture.carol.id);

            assert.equal(await Chat.countBy({ id: survivor.id }), 1);
            assert.deepEqual(published, []);
        });

        it('resolves when the user has no chat at all', async () => {
            const fixture = await createFixture();

            await service.removeUserFromAllChats(fixture.carol.id);

            assert.deepEqual(published, []);
        });
    });

    describe('chat deletion cascade', () => {
        it('removes the messages of a deleted chat through the foreign key', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            const survivorChat = await seedChat(fixture);
            await seedMessage(chat.id, fixture.alice.id);
            await seedMessage(chat.id, fixture.bob.id);
            const survivor = await seedMessage(survivorChat.id, fixture.alice.id);

            await Chat.delete({ id: chat.id });

            assert.equal(await ChatMessage.countBy({ chat: chat.id }), 0);
            assert.equal(await ChatMessage.countBy({ id: survivor.id }), 1);
        });

        it('removes the messages when a chat is deleted while emptying a user', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture, { participants: [fixture.bob.id] });
            await seedMessage(chat.id, fixture.bob.id);

            await service.removeUserFromAllChats(fixture.bob.id);

            assert.equal(await ChatMessage.count(), 0);
        });

        it('removes the chats and their messages when the team is deleted', async () => {
            const fixture = await createFixture();
            const chat = await seedChat(fixture);
            await seedMessage(chat.id, fixture.alice.id);

            await Team.delete({ id: fixture.team.id });

            assert.equal(await Chat.countBy({ id: chat.id }), 0);
            assert.equal(await ChatMessage.count(), 0);
        });
    });
});
