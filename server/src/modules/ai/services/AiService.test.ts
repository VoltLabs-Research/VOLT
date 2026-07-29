import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import { closeRedisHandles } from '@tests/redis-handles';
import AIConversation from '@modules/ai/models/AIConversation';
import AIMessage from '@modules/ai/models/AIMessage';
import Team from '@modules/team/models/Team';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import User from '@modules/auth/models/User';
import AiService from '@modules/ai/services/AiService';
import aiSdkChatTransport from '@modules/ai/services/AISDKChatTransport';
import type { AIChatFinishEvent, AIChatReplyStream } from '@modules/ai/services/AISDKChatTransport';
import { AIConversationMessageRole } from '@modules/ai/contracts/domain/ai-message';
import type { AIConversationMessage } from '@modules/ai/contracts/domain/ai-message';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';

interface TeamFixture{
    team: Team;
    owner: User;
    role: TeamRole;
}

const AN_ENTITY_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6';

const replyStream: AIChatReplyStream = { pipeToResponse: () => undefined };

const userTurn = (text: string): AIConversationMessage => ({
    id: 'ui-1',
    role: AIConversationMessageRole.User,
    parts: [{
        type: 'text',
        text
    }]
});

const assistantTurn = (): AIConversationMessage => ({
    id: 'ui-2',
    role: AIConversationMessageRole.Assistant,
    parts: [{
        type: 'text',
        text: 'partial'
    }]
});

describe('AiService', () => {
    let dataSource: DataSource;
    const service = new AiService();
    let finishEvent: AIChatFinishEvent;
    let transportCalls: Record<string, unknown>[] = [];

    before(async () => {
        dataSource = await createHarness([
            AIConversation,
            AIMessage,
            Team,
            TeamMember,
            TeamRole,
            User
        ]);

        aiSdkChatTransport.generateReplyStream = (async (input: Record<string, unknown>) => {
            transportCalls.push(input);
            const onFinish = input.onFinish as (event: AIChatFinishEvent) => Promise<void>;
            await onFinish(finishEvent);
            return replyStream;
        }) as unknown as typeof aiSdkChatTransport.generateReplyStream;
    });

    after(async () => {
        await destroyHarness(dataSource);
        closeRedisHandles();
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
        transportCalls = [];
        finishEvent = {
            text: 'the answer',
            totalUsage: {
                inputTokens: 10,
                outputTokens: 5,
                totalTokens: 15
            },
            finishReason: 'stop',
            steps: [],
            responseMessages: [{
                role: 'assistant',
                content: [{
                    type: 'text',
                    text: 'the answer'
                }]
            }],
            provider: 'openai',
            model: 'gpt-4o-mini'
        };
    });

    const createTeamFixture = async (name: string): Promise<TeamFixture> => {
        const owner = await User.create({
            email: `owner-${name}@volt.test`,
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name,
            owner: owner.id
        }).save();
        const role = await TeamRole.create({
            team: team.id,
            name: `owner-${name}`,
            permissions: []
        }).save();
        await TeamMember.create({
            team: team.id,
            user: owner.id,
            role: role.id
        }).save();

        return {
            team,
            owner,
            role
        };
    };

    const seedConversation = (fixture: TeamFixture, overrides: Partial<AIConversation> = {}): Promise<AIConversation> => AIConversation.create({
        teamId: fixture.team.id,
        userId: fixture.owner.id,
        title: 'New Conversation',
        isArchived: false,
        lastMessageAt: null,
        ...overrides
    }).save();

    describe('createConversation', () => {
        it('creates an untitled conversation without a first message', async () => {
            const fixture = await createTeamFixture('one');

            const result = await service.createConversation({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.equal(result.conversation.title, 'New Conversation');
            assert.equal(result.conversation.lastMessageAt, null);
            assert.equal(result.userMessage, undefined);
            assert.equal(await AIMessage.count(), 0);
        });

        it('stores the first message as a user turn when the title matches it', async () => {
            const fixture = await createTeamFixture('one');

            const result = await service.createConversation({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                title: 'what is a trajectory',
                message: 'what is a trajectory'
            });

            assert.equal(result.userMessage?.role, AIMessageRole.User);
            assert.equal(result.userMessage?.content, 'what is a trajectory');
            assert.deepEqual(result.userMessage?.parts, [{
                type: 'text',
                text: 'what is a trajectory'
            }]);
            assert.ok(result.conversation.lastMessageAt instanceof Date);
        });

        it('rejects a first message that does not match the title', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.createConversation({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    title: 'a title',
                    message: 'another message'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.VALIDATION_INVALID_INPUT);
                    assert.equal(error.message, 'title must match the first message');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
            assert.equal(await AIConversation.count(), 0);
        });

        it('exposes the conversation identifier as _id', async () => {
            const fixture = await createTeamFixture('one');

            const result = await service.createConversation({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });
            const stored = await AIConversation.findOneByOrFail({ id: result.conversation._id });

            assert.equal(stored.teamId, fixture.team.id);
            assert.equal(stored.userId, fixture.owner.id);
        });
    });

    describe('listConversations', () => {
        it('hides the archived conversations by default', async () => {
            const fixture = await createTeamFixture('one');
            const active = await seedConversation(fixture);
            await seedConversation(fixture, { isArchived: true });

            const result = await service.listConversations({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(result.data.map((conversation) => conversation._id), [active.id]);
        });

        it('includes the archived conversations when asked with the string flag', async () => {
            const fixture = await createTeamFixture('one');
            await seedConversation(fixture);
            await seedConversation(fixture, { isArchived: true });

            const result = await service.listConversations({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                includeArchived: 'true'
            });

            assert.equal(result.total, 2);
        });

        it('excludes the conversations of another user of the same team', async () => {
            const fixture = await createTeamFixture('one');
            const other = await User.create({
                email: 'other@volt.test',
                firstName: 'grace'
            }).save();

            const mine = await seedConversation(fixture);
            await AIConversation.create({
                teamId: fixture.team.id,
                userId: other.id,
                title: 'theirs'
            }).save();

            const result = await service.listConversations({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(result.data.map((conversation) => conversation._id), [mine.id]);
        });

        it('excludes the conversations of the same user in another team', async () => {
            const fixture = await createTeamFixture('one');
            const otherFixture = await createTeamFixture('two');

            const mine = await seedConversation(fixture);
            await AIConversation.create({
                teamId: otherFixture.team.id,
                userId: fixture.owner.id,
                title: 'other team'
            }).save();

            const result = await service.listConversations({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(result.data.map((conversation) => conversation._id), [mine.id]);
        });

        it('defaults the page size to fifty and caps it at two hundred', async () => {
            const fixture = await createTeamFixture('one');
            await seedConversation(fixture);

            const defaults = await service.listConversations({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });
            const capped = await service.listConversations({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                limit: 5000
            });

            assert.equal(defaults.limit, 50);
            assert.equal(capped.limit, 200);
        });

        it('reports the page metadata of the requested page', async () => {
            const fixture = await createTeamFixture('one');
            await seedConversation(fixture);
            await seedConversation(fixture);
            await seedConversation(fixture);

            const result = await service.listConversations({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                page: 2,
                limit: 2
            });

            assert.equal(result.total, 3);
            assert.equal(result.page, 2);
            assert.equal(result.totalPages, 2);
            assert.equal(result.data.length, 1);
        });

        it('returns the most recently active conversation first', async () => {
            const fixture = await createTeamFixture('one');
            const stale = await seedConversation(fixture, { lastMessageAt: new Date('2024-01-01T00:00:00.000Z') });
            const fresh = await seedConversation(fixture, { lastMessageAt: new Date('2024-06-01T00:00:00.000Z') });

            const result = await service.listConversations({
                teamId: fixture.team.id,
                userId: fixture.owner.id
            });

            assert.deepEqual(result.data.map((conversation) => conversation._id), [fresh.id, stale.id]);
        });
    });

    describe('listMessages', () => {
        it('returns the messages of the conversation oldest first', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);

            const first = await AIMessage.create({
                conversationId: conversation.id,
                role: AIMessageRole.User,
                parts: [],
                content: 'first'
            }).save();
            const second = await AIMessage.create({
                conversationId: conversation.id,
                role: AIMessageRole.Assistant,
                parts: [],
                content: 'second'
            }).save();

            await AIMessage.update({ id: first.id }, { createdAt: new Date('2024-01-01T00:00:00.000Z') });
            await AIMessage.update({ id: second.id }, { createdAt: new Date('2024-06-01T00:00:00.000Z') });

            const result = await service.listMessages({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id
            });

            assert.deepEqual(result.data.map((message) => message._id), [first.id, second.id]);
        });

        it('rejects a conversation that does not exist', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.listMessages({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    conversationId: AN_ENTITY_ID
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.AI_CONVERSATION_NOT_FOUND);
                    assert.equal(error.message, 'AI conversation not found');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('rejects a conversation owned by another user', async () => {
            const fixture = await createTeamFixture('one');
            const other = await User.create({
                email: 'other@volt.test',
                firstName: 'grace'
            }).save();
            const conversation = await seedConversation(fixture);

            await assert.rejects(
                () => service.listMessages({
                    teamId: fixture.team.id,
                    userId: other.id,
                    conversationId: conversation.id
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.AI_CONVERSATION_NOT_FOUND);
                    return true;
                }
            );
        });

        it('reports no artifacts when no tool produced any output', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);
            await AIMessage.create({
                conversationId: conversation.id,
                role: AIMessageRole.Assistant,
                parts: [],
                content: 'plain'
            }).save();

            const result = await service.listMessages({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id
            });

            assert.equal(result.data[0].artifacts, null);
        });

        it('derives the artifacts from the stored tool results', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);
            const message = await AIMessage.create({
                conversationId: conversation.id,
                role: AIMessageRole.Assistant,
                parts: [],
                content: 'with tools',
                modelInfo: {
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                    finishReason: 'stop',
                    steps: [{
                        stepNumber: 1,
                        toolCalls: [],
                        toolResults: [{
                            toolName: 'listTrajectories',
                            input: {},
                            output: {
                                payloadType: 'table',
                                summary: 'one row'
                            }
                        }]
                    }]
                }
            }).save();

            const result = await service.listMessages({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id
            });
            const artifacts = result.data[0].artifacts;

            assert.equal(artifacts?.items.length, 1);
            assert.equal(artifacts?.items[0].id, `${message.id}:step-0:tool-result-0`);
            assert.equal(artifacts?.items[0].kind, 'table');
            assert.equal(artifacts?.items[0].toolName, 'listTrajectories');
        });

        it('falls back to an unknown artifact kind for an unrecognised payload type', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);
            await AIMessage.create({
                conversationId: conversation.id,
                role: AIMessageRole.Assistant,
                parts: [],
                content: 'with tools',
                modelInfo: {
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                    finishReason: 'stop',
                    steps: [{
                        stepNumber: 1,
                        toolCalls: [],
                        toolResults: [{
                            toolName: 'listTrajectories',
                            input: {},
                            output: { payloadType: 'spreadsheet' }
                        }]
                    }]
                }
            }).save();

            const result = await service.listMessages({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id
            });

            assert.equal(result.data[0].artifacts?.items[0].kind, 'unknown');
        });
    });

    describe('streamMessage', () => {
        it('rejects a request without ui messages', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);

            await assert.rejects(
                () => service.streamMessage({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    conversationId: conversation.id,
                    messages: []
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS);
                    assert.equal(error.message, 'UI messages are required');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
        });

        it('rejects a user that is not a member of the team', async () => {
            const fixture = await createTeamFixture('one');
            const stranger = await User.create({
                email: 'stranger@volt.test',
                firstName: 'grace'
            }).save();
            const conversation = await AIConversation.create({
                teamId: fixture.team.id,
                userId: stranger.id,
                title: 'theirs'
            }).save();

            await assert.rejects(
                () => service.streamMessage({
                    teamId: fixture.team.id,
                    userId: stranger.id,
                    conversationId: conversation.id,
                    messages: [userTurn('hello')]
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN);
                    assert.equal(error.statusCode, 403);
                    return true;
                }
            );
        });

        it('rejects a conversation that does not exist', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.streamMessage({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    conversationId: AN_ENTITY_ID,
                    messages: [userTurn('hello')]
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.AI_CONVERSATION_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('persists the user turn and the assistant answer', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);

            const result = await service.streamMessage({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id,
                messages: [userTurn('what is a trajectory')]
            });
            const assistantMessage = await result.assistantMessage;

            assert.equal(result.userMessage?.content, 'what is a trajectory');
            assert.equal(assistantMessage?.role, AIMessageRole.Assistant);
            assert.equal(assistantMessage?.content, 'the answer');
            assert.deepEqual(assistantMessage?.tokenUsage, {
                inputTokens: 10,
                outputTokens: 5,
                totalTokens: 15
            });
            assert.equal(await AIMessage.countBy({ conversationId: conversation.id }), 2);
        });

        it('stamps the conversation with the provider and the model of the answer', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);

            const result = await service.streamMessage({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id,
                messages: [userTurn('hello')]
            });
            await result.assistantMessage;
            const stored = await AIConversation.findOneByOrFail({ id: conversation.id });

            assert.equal(stored.lastProvider, 'openai');
            assert.equal(stored.lastModel, 'gpt-4o-mini');
            assert.ok(stored.lastMessageAt instanceof Date);
        });

        it('renames the conversation when a new title comes with the request', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);

            const result = await service.streamMessage({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id,
                title: '  renamed  ',
                messages: [userTurn('hello')]
            });
            await result.assistantMessage;

            assert.equal((await AIConversation.findOneByOrFail({ id: conversation.id })).title, 'renamed');
        });

        it('merges the answer into the last assistant message on a continuation', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);
            const existing = await AIMessage.create({
                conversationId: conversation.id,
                role: AIMessageRole.Assistant,
                parts: [{
                    type: 'text',
                    text: 'partial'
                }],
                content: 'partial',
                tokenUsage: {
                    inputTokens: 1,
                    outputTokens: 2,
                    totalTokens: 3
                }
            }).save();

            const result = await service.streamMessage({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id,
                messages: [userTurn('hello'), assistantTurn()]
            });
            const assistantMessage = await result.assistantMessage;

            assert.equal(assistantMessage?._id, existing.id);
            assert.equal(assistantMessage?.content, 'partial\nthe answer');
            assert.deepEqual(assistantMessage?.tokenUsage, {
                inputTokens: 11,
                outputTokens: 7,
                totalTokens: 18
            });
            assert.equal(result.userMessage, undefined);
            assert.equal(await AIMessage.countBy({ conversationId: conversation.id }), 1);
        });

        it('stores no user turn when the request carries no text', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);

            const result = await service.streamMessage({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id,
                messages: [{
                    id: 'ui-1',
                    role: AIConversationMessageRole.User,
                    parts: [{ type: 'step-start' }]
                }]
            });
            await result.assistantMessage;

            assert.equal(result.userMessage, undefined);
            assert.equal(await AIMessage.countBy({
                conversationId: conversation.id,
                role: AIMessageRole.User
            }), 0);
        });

        it('stores no assistant message when the answer carries no part', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);
            finishEvent = {
                ...finishEvent,
                responseMessages: []
            };

            const result = await service.streamMessage({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id,
                messages: [userTurn('hello')]
            });

            assert.equal(await result.assistantMessage, undefined);
            assert.equal(await AIMessage.countBy({
                conversationId: conversation.id,
                role: AIMessageRole.Assistant
            }), 0);
        });
    });

    describe('updateConversation', () => {
        it('trims the new title', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);

            const result = await service.updateConversation({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id,
                title: '  renamed  '
            });

            assert.equal(result.title, 'renamed');
            assert.equal((await AIConversation.findOneByOrFail({ id: conversation.id })).title, 'renamed');
        });

        it('archives the conversation', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);

            const result = await service.updateConversation({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id,
                isArchived: true
            });

            assert.equal(result.isArchived, true);
        });

        it('rejects a conversation owned by another user', async () => {
            const fixture = await createTeamFixture('one');
            const other = await User.create({
                email: 'other@volt.test',
                firstName: 'grace'
            }).save();
            const conversation = await seedConversation(fixture);

            await assert.rejects(
                () => service.updateConversation({
                    teamId: fixture.team.id,
                    userId: other.id,
                    conversationId: conversation.id,
                    title: 'stolen'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.AI_CONVERSATION_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });
    });

    describe('deleteConversation', () => {
        it('deletes the conversation and its messages', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);
            await AIMessage.create({
                conversationId: conversation.id,
                role: AIMessageRole.User,
                parts: [],
                content: 'hello'
            }).save();

            await service.deleteConversation({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id
            });

            assert.equal(await AIConversation.countBy({ id: conversation.id }), 0);
            assert.equal(await AIMessage.countBy({ conversationId: conversation.id }), 0);
        });

        it('keeps the messages of the other conversations', async () => {
            const fixture = await createTeamFixture('one');
            const conversation = await seedConversation(fixture);
            const survivor = await seedConversation(fixture);
            await AIMessage.create({
                conversationId: survivor.id,
                role: AIMessageRole.User,
                parts: [],
                content: 'keep me'
            }).save();

            await service.deleteConversation({
                teamId: fixture.team.id,
                userId: fixture.owner.id,
                conversationId: conversation.id
            });

            assert.equal(await AIMessage.countBy({ conversationId: survivor.id }), 1);
        });

        it('rejects a conversation that does not exist', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.deleteConversation({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    conversationId: AN_ENTITY_ID
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, ErrorCodes.AI_CONVERSATION_NOT_FOUND);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });

        it('answers not found instead of failing when the id is malformed', async () => {
            const fixture = await createTeamFixture('one');

            await assert.rejects(
                () => service.deleteConversation({
                    teamId: fixture.team.id,
                    userId: fixture.owner.id,
                    conversationId: 'not-an-id'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });
    });
});
