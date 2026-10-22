import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { dropRetiredTables } from '@core/bootstrap/drop-retired-tables';
import AIConversation from '@modules/ai/models/AIConversation';
import AIMessage from '@modules/ai/models/AIMessage';
import chatCompactionService, { HISTORY_BUDGET_CHARS } from '@modules/ai/services/chat/ChatCompactionService';
import chatMessageService from '@modules/ai/services/chat/ChatMessageService';
import toolRegistry from '@modules/ai/services/tools/ToolRegistry';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import { USAGE, startHarness } from './harness';
import type { Harness } from './harness';

const summarizer = (summary: string): MockLanguageModelV4 => new MockLanguageModelV4({
    doGenerate: {
        content: [{
            type: 'text',
            text: summary
        }],
        finishReason: {
            unified: 'stop',
            raw: 'stop'
        },
        usage: USAGE,
        warnings: []
    }
});

const seed = async (conversationId: string, count: number, size: number): Promise<void> => {
    for (let index = 0; index < count; index += 1) {
        await chatMessageService.create(conversationId, {
            role: index % 2 === 0 ? AIMessageRole.User : AIMessageRole.Assistant,
            parts: [{
                type: 'text',
                text: `${index}:${'x'.repeat(size)}`
            }]
        });
    }
};

describe('AI chat memory', () => {
    let harness: Harness;

    before(async () => {
        toolRegistry.register([]);
        harness = await startHarness();
    });

    after(async () => {
        await harness.close();
    });

    test('leaves a history that fits alone', async () => {
        const conversation = await harness.conversation();
        await seed(conversation.id, 4, 100);
        const model = summarizer('never used');

        const history = await chatCompactionService.fitted(conversation, await chatCompactionService.load(conversation), model);

        assert.equal(history.messages.length, 4);
        assert.equal(history.summary, null);
        assert.equal(model.doGenerateCalls.length, 0);
    });

    test('folds the oldest messages into the summary once the history outgrows its budget', async () => {
        const conversation = await harness.conversation();
        const size = Math.ceil(HISTORY_BUDGET_CHARS / 6);
        await seed(conversation.id, 10, size);

        const history = await chatCompactionService.fitted(conversation, await chatCompactionService.load(conversation), summarizer('The user ran a pipeline on trajectory 42.'));

        assert.equal(history.summary, 'The user ran a pipeline on trajectory 42.');
        assert.ok(history.messages.length < 10);
        assert.ok(history.messages.length > 0);

        const stored = await AIConversation.findOneByOrFail({ id: conversation.id });
        const reloaded = await chatCompactionService.load(stored);
        assert.equal(reloaded.summary, history.summary);
        assert.deepEqual(reloaded.messages.map((message) => message.id), history.messages.map((message) => message.id));
    });

    test('compacts on request down to the latest exchange', async () => {
        const conversation = await harness.conversation();
        await seed(conversation.id, 6, 50);

        const compacted = await chatCompactionService.compactNow(conversation, summarizer('Earlier: a comparison of two analyses.'));

        assert.deepEqual(compacted, {
            folded: 4,
            kept: 2
        });
        const remaining = await chatCompactionService.load(await AIConversation.findOneByOrFail({ id: conversation.id }));
        assert.equal(remaining.messages.length, 2);
    });

    test('drops the tables of the conversations it no longer reads', async () => {
        const dataSource = AIMessage.getRepository().manager.connection;
        await dataSource.query('CREATE TABLE "ai_conversations" ("id" varchar PRIMARY KEY)');
        await dataSource.query('CREATE TABLE "ai_messages" ("id" varchar PRIMARY KEY, "conversationId" varchar REFERENCES "ai_conversations"("id"))');

        await dropRetiredTables(dataSource);

        const runner = dataSource.createQueryRunner();
        try {
            assert.equal(await runner.hasTable('ai_messages'), false);
            assert.equal(await runner.hasTable('ai_conversations'), false);
            assert.equal(await runner.hasTable('ai_chat_messages'), true);
        } finally {
            await runner.release();
        }
    });
});
