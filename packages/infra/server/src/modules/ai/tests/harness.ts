import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test';
import { connectDatabase, disconnectDatabase } from '@core/bootstrap/connect-database';
import User from '@modules/auth/models/User';
import Team from '@modules/team/models/Team';
import teamService from '@modules/team/services/TeamService';
import AIConversation from '@modules/ai/models/AIConversation';
import modelResolver from '@modules/ai/services/ModelResolver';
import conversationService from '@modules/ai/services/ConversationService';
import chatStreamService from '@modules/ai/services/chat/ChatStreamService';
import type { ChatFrame } from '@modules/ai/contracts/chat';
import { AIProvider } from '@volt/contracts/modules/ai/domain';
import type { ChatTurnPayload } from '@volt/contracts/modules/ai/socket';
import { generateEntityId } from '@shared/persistence/entity-id';

type LanguageModelV4StreamPart = Awaited<ReturnType<MockLanguageModelV4['doStream']>>['stream'] extends ReadableStream<infer Part> ? Part : never;

export const USAGE = {
    inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: 0,
        cacheWrite: 0
    },
    outputTokens: {
        total: 5,
        text: 5,
        reasoning: 0
    }
};

export const textStep = (text: string): LanguageModelV4StreamPart[] => [
    {
        type: 'stream-start',
        warnings: []
    },
    {
        type: 'text-start',
        id: 't1'
    },
    {
        type: 'text-delta',
        id: 't1',
        delta: text
    },
    {
        type: 'text-end',
        id: 't1'
    },
    {
        type: 'finish',
        finishReason: {
            unified: 'stop',
            raw: 'stop'
        },
        usage: USAGE
    }
];

export const toolStep = (toolCallId: string, toolName: string, input: unknown): LanguageModelV4StreamPart[] => [
    {
        type: 'stream-start',
        warnings: []
    },
    {
        type: 'tool-call',
        toolCallId,
        toolName,
        input: JSON.stringify(input)
    },
    {
        type: 'finish',
        finishReason: {
            unified: 'tool-calls',
            raw: 'tool_calls'
        },
        usage: USAGE
    }
];

// A model that answers each call with the next scripted step.
export const scriptedModel = (steps: LanguageModelV4StreamPart[][]): MockLanguageModelV4 => new MockLanguageModelV4({
    doStream: steps.map((parts) => ({ stream: convertArrayToReadableStream(parts) }))
});

export interface Harness {
    userId: string;
    teamId: string;
    permissions: string[];
    useModel: (model: MockLanguageModelV4) => void;
    conversation: () => Promise<AIConversation>;
    turn: (payload: ChatTurnPayload, origin?: string) => Promise<ChatFrame[]>;
    close: () => Promise<void>;
}

export const startHarness = async (): Promise<Harness> => {
    // Models pick their column types from DATABASE_URL when they load, so it is set by the test command.
    if (process.env.DATABASE_URL?.startsWith('sqlite:') !== true) {
        throw new Error('Run these tests with DATABASE_URL=sqlite::memory: (pnpm test does).');
    }

    await connectDatabase();

    const user = await User.create({
        email: `${generateEntityId()}@example.test`,
        password: null,
        firstName: 'Ada'
    }).save();
    const team = await Team.create({
        name: 'Lab',
        owner: user.id
    }).save();

    const harness: Harness = {
        userId: user.id,
        teamId: team.id,
        permissions: ['*'],
        useModel: (model) => {
            modelResolver.resolve = async () => ({
                model,
                provider: AIProvider.OpenAI,
                modelName: 'mock-model-id'
            });
        },
        conversation: () => conversationService.create({
            teamId: team.id,
            userId: user.id
        }, { title: 'Probe' }),
        turn: async (payload, origin = 'socket-1') => {
            const prepared = await chatStreamService.prepare(user.id, payload, origin);
            const frames: ChatFrame[] = [];
            for await (const frame of chatStreamService.respond(prepared, payload)) frames.push(frame);

            return frames;
        },
        close: () => disconnectDatabase()
    };

    teamService.getMyPermissions = async () => ({ permissions: harness.permissions });

    return harness;
};
