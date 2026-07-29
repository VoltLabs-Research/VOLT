import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import AIConversation from '@modules/ai/models/AIConversation';
import AIMessage from '@modules/ai/models/AIMessage';
import Team from '@modules/team/models/Team';
import User from '@modules/auth/models/User';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import type { AIMessageParts } from '@modules/ai/contracts/domain/ai-message';

interface ConversationFixture{
    team: Team;
    owner: User;
    conversation: AIConversation;
}

describe('AIMessage model', () => {
    let dataSource: DataSource;

    before(async () => {
        dataSource = await createHarness([AIConversation, AIMessage, Team, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createConversationFixture = async (name = 'one'): Promise<ConversationFixture> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name,
            owner: owner.id
        }).save();
        const conversation = await AIConversation.create({
            teamId: team.id,
            userId: owner.id,
            title: 'New Conversation'
        }).save();

        return {
            team,
            owner,
            conversation
        };
    };

    const seedMessage = async (
        fixture: ConversationFixture,
        overrides: Partial<AIMessage> = {}
    ): Promise<AIMessage> => {
        const message = await AIMessage.create({
            conversationId: fixture.conversation.id,
            role: AIMessageRole.User,
            parts: [{
                type: 'text',
                text: 'hello'
            }],
            content: 'hello',
            modelInfo: null,
            tokenUsage: null,
            ...overrides
        }).save();

        return AIMessage.findOneByOrFail({ id: message.id });
    };

    it('round-trips the message parts untouched', async () => {
        const fixture = await createConversationFixture();
        const parts: AIMessageParts = [
            {
                type: 'text',
                text: 'hello'
            },
            {
                type: 'tool-call',
                toolName: 'listTrajectories',
                input: {
                    teamId: 'team-1',
                    limit: 5
                }
            }
        ];

        const reloaded = await seedMessage(fixture, { parts });

        assert.deepEqual(reloaded.parts, parts);
    });

    it('reads back a date inside the parts as an ISO string', async () => {
        const fixture = await createConversationFixture();
        const createdAt = new Date('2024-05-04T03:02:01.000Z');

        const reloaded = await seedMessage(fixture, {
            parts: [{
                type: 'text',
                text: 'hello',
                createdAt
            }]
        });

        assert.equal(reloaded.parts[0].createdAt, createdAt.toISOString());
    });

    it('drops the undefined keys of the parts', async () => {
        const fixture = await createConversationFixture();

        const reloaded = await seedMessage(fixture, {
            parts: [{
                type: 'text',
                text: 'hello',
                toolName: undefined,
                state: undefined
            }]
        });

        assert.deepEqual(Object.keys(reloaded.parts[0]), ['type', 'text']);
    });

    it('round-trips the model info with its nested tool steps', async () => {
        const fixture = await createConversationFixture();
        const modelInfo = {
            provider: 'openai',
            model: 'gpt-4o-mini',
            finishReason: 'stop',
            steps: [{
                stepNumber: 1,
                toolCalls: [{
                    toolName: 'listTrajectories',
                    input: { teamId: 'team-1' }
                }],
                toolResults: [{
                    toolName: 'listTrajectories',
                    input: { teamId: 'team-1' },
                    output: {
                        payloadType: 'table',
                        summary: 'one row'
                    }
                }]
            }]
        };

        const reloaded = await seedMessage(fixture, {
            role: AIMessageRole.Assistant,
            modelInfo
        });

        assert.deepEqual(reloaded.modelInfo, modelInfo);
    });

    it('round-trips the token usage untouched', async () => {
        const fixture = await createConversationFixture();
        const tokenUsage = {
            inputTokens: 11,
            outputTokens: 22,
            totalTokens: 33
        };

        const reloaded = await seedMessage(fixture, {
            role: AIMessageRole.Assistant,
            tokenUsage
        });

        assert.deepEqual(reloaded.tokenUsage, tokenUsage);
    });

    it('reads back an absent model info and token usage as null', async () => {
        const fixture = await createConversationFixture();

        const reloaded = await seedMessage(fixture);

        assert.equal(reloaded.modelInfo, null);
        assert.equal(reloaded.tokenUsage, null);
    });

    it('defaults the parts to an empty array', async () => {
        const fixture = await createConversationFixture();

        const message = await AIMessage.create({
            conversationId: fixture.conversation.id,
            role: AIMessageRole.User,
            content: ''
        }).save();
        const reloaded = await AIMessage.findOneByOrFail({ id: message.id });

        assert.deepEqual(reloaded.parts, []);
    });

    it('accepts the user and assistant roles', async () => {
        const fixture = await createConversationFixture();

        const user = await seedMessage(fixture, { role: AIMessageRole.User });
        const assistant = await seedMessage(fixture, { role: AIMessageRole.Assistant });

        assert.equal(user.role, 'user');
        assert.equal(assistant.role, 'assistant');
    });

    it('refuses a system role because the database enum only allows user and assistant', async () => {
        const fixture = await createConversationFixture();

        await assert.rejects(() => AIMessage.create({
            conversationId: fixture.conversation.id,
            role: 'system' as AIMessageRole,
            parts: [],
            content: 'you are a helpful assistant',
            modelInfo: null,
            tokenUsage: null
        }).save());
    });

    it('deletes the messages of a conversation removed by the foreign key cascade', async () => {
        const fixture = await createConversationFixture();
        await seedMessage(fixture);
        await seedMessage(fixture, { role: AIMessageRole.Assistant });

        await AIConversation.delete({ id: fixture.conversation.id });

        assert.equal(await AIMessage.countBy({ conversationId: fixture.conversation.id }), 0);
    });

    it('keeps the messages of the other conversations when one is deleted', async () => {
        const fixture = await createConversationFixture();
        const otherConversation = await AIConversation.create({
            teamId: fixture.team.id,
            userId: fixture.owner.id,
            title: 'Another Conversation'
        }).save();

        await seedMessage(fixture);
        const survivor = await seedMessage({
            ...fixture,
            conversation: otherConversation
        });

        await AIConversation.delete({ id: fixture.conversation.id });

        const remaining = await AIMessage.find();
        assert.deepEqual(remaining.map((message) => message.id), [survivor.id]);
    });

    it('deletes the conversations of a team removed by the foreign key cascade', async () => {
        const fixture = await createConversationFixture();
        await seedMessage(fixture);

        await Team.delete({ id: fixture.team.id });

        assert.equal(await AIConversation.countBy({ teamId: fixture.team.id }), 0);
        assert.equal(await AIMessage.countBy({ conversationId: fixture.conversation.id }), 0);
    });

    it('emits the identifier as _id and never as id on the wire', async () => {
        const fixture = await createConversationFixture();
        const message = await seedMessage(fixture);

        const wire = message.toJSON();

        assert.equal(wire._id, message.id);
        assert.equal(Object.prototype.hasOwnProperty.call(wire, 'id'), false);
    });

    it('emits an unloaded conversation reference as its id string', async () => {
        const fixture = await createConversationFixture();
        const message = await seedMessage(fixture);

        assert.equal(message.toJSON().conversationId, fixture.conversation.id);
    });
});
