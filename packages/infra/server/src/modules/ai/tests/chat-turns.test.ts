import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import typia from 'typia';
import { isToolUIPart } from 'ai';
import AIToolController from '@shared/ai/AIToolController';
import { AITool, AIToolAccess, BrowserAITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { generateEntityId } from '@shared/persistence/entity-id';
import ApplicationError from '@shared/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import AIMessage from '@modules/ai/models/AIMessage';
import conversationService from '@modules/ai/services/ConversationService';
import chatPresence from '@modules/ai/services/chat/ChatPresence';
import chatStreamService from '@modules/ai/services/chat/ChatStreamService';
import toolRegistry from '@modules/ai/services/tools/ToolRegistry';
import type { ChatMessagePart } from '@volt/contracts/modules/ai/chat';
import { AI_CHAT_EVENTS } from '@volt/contracts/modules/ai/socket';
import { scriptedModel, startHarness, textStep, toolStep } from './harness';
import type { Harness } from './harness';

interface ProbeInput {
    value: string;
}

const written: string[] = [];

class ProbeTools extends AIToolController {
    @AITool({
        name: 'probe_read',
        description: 'Read a probe.',
        parameters: typia.llm.parameters<ProbeInput>(),
        validate: typia.createValidate<ProbeInput>(),
        access: AIToolAccess.Read,
        permission: 'trajectory:read'
    })
    probeRead(input: ProbeInput & AIToolScope) {
        return {
            summary: `read ${input.value}`,
            team: input.teamId
        };
    }

    @AITool({
        name: 'probe_write',
        description: 'Write a probe.',
        parameters: typia.llm.parameters<ProbeInput>(),
        validate: typia.createValidate<ProbeInput>(),
        access: AIToolAccess.Write,
        permission: 'trajectory:delete'
    })
    probeWrite(input: ProbeInput & AIToolScope) {
        written.push(input.value);
        return { summary: `wrote ${input.value}` };
    }

    @BrowserAITool({
        name: 'probe_browser',
        description: 'Act in the browser.',
        parameters: typia.llm.parameters<ProbeInput>(),
        validate: typia.createValidate<ProbeInput>(),
        access: AIToolAccess.Read,
        permission: null
    })
    probeBrowser(): void {}
}

const toolParts = (parts: ChatMessagePart[]) => parts.filter(isToolUIPart);

const say = (conversationId: string, text: string) => ({
    conversationId,
    message: {
        id: generateEntityId(),
        text
    }
});

describe('AI chat turns', () => {
    let harness: Harness;

    before(async () => {
        toolRegistry.register([ProbeTools]);
        harness = await startHarness();
    });

    after(async () => {
        await harness.close();
    });

    beforeEach(() => {
        written.length = 0;
        harness.permissions = ['*'];
    });

    test('stores the user message under its own id and the reply as the parts it streamed', async () => {
        harness.useModel(scriptedModel([textStep('Hello there')]));
        const conversation = await harness.conversation();
        const payload = say(conversation.id, 'Hi');

        const frames = await harness.turn(payload);

        const saved = frames.filter((frame) => frame.type === 'saved');
        assert.equal(saved.length, 2);
        assert.equal(saved[0].type === 'saved' && saved[0].message._id, payload.message.id);

        const chunks = frames.flatMap((frame) => (frame.type === 'chunk' ? [frame.chunk.type] : []));
        assert.deepEqual(chunks.filter((type) => type === 'start' || type === 'finish'), ['start', 'finish']);

        const rows = await AIMessage.find({
            where: { conversationId: conversation.id },
            order: { position: 'ASC' }
        });
        assert.deepEqual(rows.map((row) => row.position), [1, 2]);
        assert.deepEqual(rows[1].parts.filter((part) => part.type === 'text').map((part) => part.type === 'text' && part.text), ['Hello there']);
    });

    test('serves history newest first', async () => {
        harness.useModel(scriptedModel([textStep('One'), textStep('Two')]));
        const conversation = await harness.conversation();
        await harness.turn(say(conversation.id, 'first'));
        await harness.turn(say(conversation.id, 'second'));

        const page = await conversationService.messages({
            teamId: harness.teamId,
            userId: harness.userId,
            conversationId: conversation.id,
            limit: 2
        });

        assert.equal(page.total, 4);
        assert.deepEqual(page.data.map((message) => message.role), ['assistant', 'user']);
        assert.equal(page.data[1].parts[0].type === 'text' && page.data[1].parts[0].text, 'second');
    });

    test('runs a read tool inside the loop and stores its raw output', async () => {
        harness.useModel(scriptedModel([toolStep('call-read', 'probe_read', { value: 'atoms' }), textStep('Done reading')]));
        const conversation = await harness.conversation();

        await harness.turn(say(conversation.id, 'read it'));

        const reply = await AIMessage.findOneByOrFail({
            conversationId: conversation.id,
            position: 2
        });
        const [part] = toolParts(reply.parts);
        assert.equal(part.state, 'output-available');
        assert.deepEqual(part.state === 'output-available' && part.output, {
            summary: 'read atoms',
            team: harness.teamId
        });
        assert.equal(part.approval, undefined);
    });

    test('holds a write until the user approves it, then runs it once and carries on in the same reply', async () => {
        const model = scriptedModel([toolStep('call-write', 'probe_write', { value: 'frame-7' }), textStep('It is deleted.')]);
        harness.useModel(model);
        const conversation = await harness.conversation();

        await harness.turn(say(conversation.id, 'delete it'));
        assert.deepEqual(written, []);

        const held = await AIMessage.findOneByOrFail({
            conversationId: conversation.id,
            position: 2
        });
        const [card] = toolParts(held.parts);
        assert.equal(card.state, 'approval-requested');
        const approvalId = card.state === 'approval-requested' ? card.approval.id : '';

        const frames = await harness.turn({
            conversationId: conversation.id,
            approvals: [{
                approvalId,
                approved: true
            }]
        });

        assert.deepEqual(written, ['frame-7']);

        // What the client reads the continuation by: the card settles first, then the reply opens
        // again under its own id, and ends stored under it.
        const [effect, settledCopy, ...rest] = frames;
        assert.deepEqual(effect.type === 'chunk' && effect.chunk, {
            type: 'tool-output-available',
            toolCallId: 'call-write',
            output: { summary: 'wrote frame-7' }
        });
        assert.ok(settledCopy.type === 'saved' && settledCopy.message._id === held.id);
        const opening = rest.find((frame) => frame.type === 'chunk' && frame.chunk.type === 'start');
        assert.ok(opening?.type === 'chunk' && opening.chunk.type === 'start' && opening.chunk.messageId === held.id);
        const last = rest[rest.length - 1];
        assert.ok(last.type === 'saved' && last.message._id === held.id);
        const rows = await AIMessage.find({
            where: { conversationId: conversation.id },
            order: { position: 'ASC' }
        });
        assert.equal(rows.length, 2);

        const [settled] = toolParts(rows[1].parts);
        assert.equal(settled.state, 'output-available');
        assert.equal(settled.approval?.approved, true);
        assert.ok(rows[1].parts.some((part) => part.type === 'text' && part.text === 'It is deleted.'));
        assert.equal(model.doStreamCalls.length, 2);
    });

    test('records a rejection as denied and never runs the tool', async () => {
        harness.useModel(scriptedModel([toolStep('call-write', 'probe_write', { value: 'frame-9' }), textStep('Kept it.')]));
        const conversation = await harness.conversation();
        await harness.turn(say(conversation.id, 'delete it'));

        const held = await AIMessage.findOneByOrFail({
            conversationId: conversation.id,
            position: 2
        });
        const [card] = toolParts(held.parts);
        const approvalId = card.state === 'approval-requested' ? card.approval.id : '';

        await harness.turn({
            conversationId: conversation.id,
            approvals: [{
                approvalId,
                approved: false
            }]
        });

        assert.deepEqual(written, []);
        const settled = await AIMessage.findOneByOrFail({ id: held.id });
        const [denied] = toolParts(settled.parts);
        assert.equal(denied.state, 'output-denied');
        assert.equal(denied.approval?.approved, false);
    });

    test('checks the permission again when the card is approved', async () => {
        harness.useModel(scriptedModel([toolStep('call-write', 'probe_write', { value: 'frame-3' }), textStep('Could not.')]));
        const conversation = await harness.conversation();
        await harness.turn(say(conversation.id, 'delete it'));

        const held = await AIMessage.findOneByOrFail({
            conversationId: conversation.id,
            position: 2
        });
        const [card] = toolParts(held.parts);
        const approvalId = card.state === 'approval-requested' ? card.approval.id : '';

        harness.permissions = ['ai-conversation:create', 'trajectory:read'];
        await harness.turn({
            conversationId: conversation.id,
            approvals: [{
                approvalId,
                approved: true
            }]
        });

        assert.deepEqual(written, []);
        const [failed] = toolParts((await AIMessage.findOneByOrFail({ id: held.id })).parts);
        assert.equal(failed.state, 'output-error');
    });

    test('refuses an approval it never asked for', async () => {
        harness.useModel(scriptedModel([textStep('Nothing to approve')]));
        const conversation = await harness.conversation();

        await assert.rejects(harness.turn({
            conversationId: conversation.id,
            approvals: [{
                approvalId: 'forged',
                approved: true
            }]
        }), (error: unknown) => error instanceof ApplicationError && error.code === ErrorCodes.AI_APPROVAL_NOT_FOUND);
        assert.deepEqual(written, []);
    });

    test('offers the model only the tools the user may use', async () => {
        harness.permissions = ['ai-conversation:create', 'trajectory:read'];
        const model = scriptedModel([textStep('ok')]);
        harness.useModel(model);
        const conversation = await harness.conversation();

        await harness.turn(say(conversation.id, 'what can you do'));

        const offered = (model.doStreamCalls[0].tools ?? []).map((tool) => tool.name).sort();
        assert.deepEqual(offered, ['probe_browser', 'probe_read']);
    });

    test('asks the tab that drives the turn to run a browser tool', async () => {
        const asked: unknown[] = [];
        const original = socketIOEmitter.emitWithAckToSocket;
        socketIOEmitter.emitWithAckToSocket = async (socketId, event, data) => {
            asked.push({
                socketId,
                event,
                data
            });
            return {
                ok: true,
                summary: 'Opened the viewer.'
            };
        };

        try {
            harness.useModel(scriptedModel([toolStep('call-browser', 'probe_browser', { value: 'viewer' }), textStep('Opened.')]));
            const conversation = await harness.conversation();
            chatPresence.join('socket-1', conversation.id);

            await harness.turn(say(conversation.id, 'show me'), 'socket-1');

            assert.equal(asked.length, 1);
            assert.deepEqual(asked[0], {
                socketId: 'socket-1',
                event: AI_CHAT_EVENTS.toolInvoke,
                data: {
                    conversationId: conversation.id,
                    teamId: conversation.teamId,
                    toolCallId: 'call-browser',
                    toolName: 'probe_browser',
                    input: { value: 'viewer' }
                }
            });

            const reply = await AIMessage.findOneByOrFail({
                conversationId: conversation.id,
                position: 2
            });
            const [part] = toolParts(reply.parts);
            assert.deepEqual(part.state === 'output-available' && part.output, {
                ok: true,
                summary: 'Opened the viewer.'
            });
            chatPresence.drop('socket-1');
        } finally {
            socketIOEmitter.emitWithAckToSocket = original;
        }
    });

    test('tells the model when no tab can run a browser tool', async () => {
        harness.useModel(scriptedModel([toolStep('call-browser', 'probe_browser', { value: 'viewer' }), textStep('Could not.')]));
        const conversation = await harness.conversation();

        await harness.turn(say(conversation.id, 'show me'), 'socket-gone');

        const reply = await AIMessage.findOneByOrFail({
            conversationId: conversation.id,
            position: 2
        });
        const [part] = toolParts(reply.parts);
        assert.equal(part.state === 'output-available' && (part.output as { reason?: string }).reason, 'browser_unavailable');
    });

    test('refuses a second turn while one is live, and replays the live one', async () => {
        harness.useModel(scriptedModel([textStep('slow')]));
        const conversation = await harness.conversation();
        const payload = say(conversation.id, 'first');
        const prepared = await chatStreamService.prepare(harness.userId, payload, 'socket-1');

        await assert.rejects(
            chatStreamService.prepare(harness.userId, say(conversation.id, 'second'), 'socket-1'),
            (error: unknown) => error instanceof ApplicationError && error.code === ErrorCodes.AI_TURN_IN_PROGRESS
        );

        const frames = chatStreamService.respond(prepared, payload)[Symbol.asyncIterator]();
        await frames.next();
        await frames.next();
        assert.equal(chatStreamService.isLive(conversation.id), true);
        assert.ok(chatStreamService.replay(conversation.id).some((chunk) => chunk.type === 'start'));

        for (let next = await frames.next(); next.done !== true; next = await frames.next());
        assert.equal(chatStreamService.isLive(conversation.id), false);
    });

    test('keeps what was said when the user stops the turn', async () => {
        harness.useModel(scriptedModel([textStep('Partial answer')]));
        const conversation = await harness.conversation();
        const payload = say(conversation.id, 'go');
        const prepared = await chatStreamService.prepare(harness.userId, payload, 'socket-1');

        const chunks: string[] = [];
        for await (const frame of chatStreamService.respond(prepared, payload)) {
            if (frame.type !== 'chunk') continue;
            chunks.push(frame.chunk.type);
            if (frame.chunk.type === 'text-delta') chatStreamService.stop(conversation.id);
        }

        assert.ok(chunks.includes('abort'));
        assert.ok(!chunks.includes('finish'));
        const reply = await AIMessage.findOneBy({
            conversationId: conversation.id,
            position: 2
        });
        assert.ok(reply?.parts.some((part) => part.type === 'text' && part.text === 'Partial answer'));
    });
});
