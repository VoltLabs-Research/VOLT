import { AIMessageRole, AIProvider } from '@volt/contracts/modules/ai/domain';
import {
    COORDINATION_ANALYSIS_ID,
    COORDINATION_CONFIG,
    COORDINATION_FRAMES,
    COORDINATION_PLUGIN_ID,
    COORDINATION_PRIMARY_EXPOSURE_ID
} from '@/modules/marketing/utils/landing-coordination';
import { LANDING_CLUSTER_NAME, LANDING_TEAM_ID, LANDING_USER, hoursAgo } from '@/modules/marketing/utils/landing-workspace';
import { SAMPLE_ATOMS, SHEAR_DEFORMATION_ID } from '@/modules/marketing/utils/landing-trajectories';
import type { AIConversationMessage, ChatMessagePart } from '@volt/contracts/modules/ai/chat';

export const LANDING_CONVERSATION_ID = 'landing-conversation';
export const LANDING_ANSWER_ID = 'landing-message-answer';

// What the visitor watches someone ask.
export const LANDING_PROMPT = 'Run Coordination Analysis on Shear Deformation and tell me where the lattice is not perfect.';

// One of the server's tools the assistant calls, with what it answers.
export interface LandingToolCall {
    id: string;
    tool: string;
    input: Record<string, unknown>;
    output: { summary: string };
    // Whether the server waits for the user's approval before it runs, as for a pipeline.
    needsApproval?: boolean;
}

const [firstFrame] = COORDINATION_FRAMES;
const PERFECT_COORDINATION = 12;

const count = (value: number): string => value.toLocaleString('en-US');
const percent = (atoms: number): string => `${((atoms / SAMPLE_ATOMS) * 100).toFixed(1)}%`;

// How the assistant gets there with the server's tools, as its system prompt has it: it finds
// the trajectory, reads the plugin's arguments, runs a one-stage pipeline once it is approved,
// follows the analysis and reads what it measured.
export const LANDING_TOOL_CALLS: LandingToolCall[] = [
    {
        id: 'landing-search',
        tool: 'global_search',
        input: { query: 'Shear Deformation' },
        output: { summary: `Found Shear Deformation: ${COORDINATION_FRAMES.length} frames of ${count(SAMPLE_ATOMS)} atoms.` }
    },
    {
        id: 'landing-arguments',
        tool: 'describe_plugin_arguments',
        input: { pluginId: COORDINATION_PLUGIN_ID },
        output: { summary: 'Coordination Analysis takes a neighbor cutoff and a number of RDF bins.' }
    },
    {
        id: 'landing-pipeline',
        tool: 'execute_pipeline',
        input: { trajectoryId: SHEAR_DEFORMATION_ID, stages: [{ pluginId: COORDINATION_PLUGIN_ID, config: COORDINATION_CONFIG }] },
        output: { summary: `Started Coordination Analysis on ${LANDING_CLUSTER_NAME}, over ${COORDINATION_FRAMES.length} frames.` },
        needsApproval: true
    },
    {
        id: 'landing-analysis',
        tool: 'get_analysis',
        input: { analysisId: COORDINATION_ANALYSIS_ID },
        output: { summary: `Coordination Analysis finished all ${COORDINATION_FRAMES.length} frames.` }
    },
    {
        id: 'landing-result',
        tool: 'summarize_analysis_result',
        input: { analysisId: COORDINATION_ANALYSIS_ID, exposureId: COORDINATION_PRIMARY_EXPOSURE_ID },
        output: { summary: `Read the coordination of all ${count(SAMPLE_ATOMS)} atoms in each frame.` }
    }
];

const perfect = firstFrame.counts[PERFECT_COORDINATION];

// The answer, in the numbers Coordination Analysis measured on the sample's first frame.
export const LANDING_ANSWER = [
    `At a ${COORDINATION_CONFIG.cutoff.toFixed(1)} Å cutoff, ${percent(perfect)} of the ${count(SAMPLE_ATOMS)} atoms in the first frame have the ${PERFECT_COORDINATION} neighbors of a perfect close-packed site.`,
    '',
    '| Coordination | Atoms | Share |',
    '| --- | --- | --- |',
    ...Object.entries(firstFrame.counts).map(([coordination, atoms]) => `| ${coordination} | ${count(atoms)} | ${percent(atoms)} |`),
    '',
    `The other ${count(SAMPLE_ATOMS - perfect)} are where the crystal is not perfect: a planar defect across the middle of the cell, and the layers along its top and bottom.`
].join('\n');

const ASKED = hoursAgo(0.4);
const ANSWERED = hoursAgo(0.38);

export const LANDING_AI_MODEL = { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' };

export const LANDING_CONVERSATIONS = [
    {
        _id: LANDING_CONVERSATION_ID,
        userId: LANDING_USER._id,
        teamId: LANDING_TEAM_ID,
        title: 'Where the lattice breaks in Shear Deformation',
        lastMessageAt: ANSWERED,
        isArchived: false,
        provider: AIProvider.Anthropic,
        model: LANDING_AI_MODEL.id,
        createdAt: ASKED,
        updatedAt: ANSWERED
    },
    {
        _id: 'landing-conversation-indentation',
        userId: LANDING_USER._id,
        teamId: LANDING_TEAM_ID,
        title: 'Dislocations under the indenter',
        lastMessageAt: hoursAgo(27),
        isArchived: false,
        provider: AIProvider.Anthropic,
        model: LANDING_AI_MODEL.id,
        createdAt: hoursAgo(28),
        updatedAt: hoursAgo(27)
    }
];

const approvalIndex = LANDING_TOOL_CALLS.findIndex((call) => call.needsApproval);

// The calls the assistant makes before it stops to ask, and those it makes once approved.
export const CALLS_BEFORE_APPROVAL = LANDING_TOOL_CALLS.slice(0, approvalIndex + 1);
export const CALLS_AFTER_APPROVAL = LANDING_TOOL_CALLS.slice(approvalIndex + 1);
export const APPROVED_CALL = LANDING_TOOL_CALLS[approvalIndex];

const toolPart = (call: LandingToolCall, isApproved: boolean): ChatMessagePart => {
    const common = {
        type: `tool-${call.tool}`,
        toolCallId: call.id,
        input: call.input
    } as const;

    if (call.needsApproval && !isApproved) {
        return {
            ...common,
            state: 'approval-requested',
            approval: { id: call.id }
        };
    }

    return {
        ...common,
        state: 'output-available',
        output: call.output,
        ...(call.needsApproval ? { approval: { id: call.id, approved: true } } : {})
    };
};

// The question as the server stores it, under the id the app sent it with.
export const landingQuestion = (id: string): AIConversationMessage => ({
    _id: id,
    conversationId: LANDING_CONVERSATION_ID,
    position: 1,
    role: AIMessageRole.User,
    parts: [{ type: 'text', text: LANDING_PROMPT }],
    createdAt: ASKED,
    updatedAt: ASKED
});

// The answer as the server stores it: waiting on the pipeline's card, or over.
export const landingAnswer = (isApproved: boolean): AIConversationMessage => ({
    _id: LANDING_ANSWER_ID,
    conversationId: LANDING_CONVERSATION_ID,
    position: 2,
    role: AIMessageRole.Assistant,
    parts: isApproved
        ? [...LANDING_TOOL_CALLS.map((call) => toolPart(call, true)), { type: 'text', text: LANDING_ANSWER }]
        : CALLS_BEFORE_APPROVAL.map((call) => toolPart(call, false)),
    createdAt: ANSWERED,
    updatedAt: ANSWERED
});

// The conversation as the server keeps it once it is over, newest first as it pages it.
export const LANDING_MESSAGES = [landingAnswer(true), landingQuestion('landing-message-ask')];

export const LANDING_AI_INTEGRATION = {
    _id: 'landing-ai-integration',
    teamId: LANDING_TEAM_ID,
    provider: 'anthropic',
    providerName: 'Anthropic',
    isEnabled: true,
    defaultModel: LANDING_AI_MODEL.id,
    enabledModels: [LANDING_AI_MODEL],
    hasApiKey: true,
    createdBy: LANDING_USER._id,
    createdAt: hoursAgo(24 * 30),
    updatedAt: hoursAgo(24 * 30)
};

// The providers the server offers a team, as it lists them.
export const LANDING_AI_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', description: 'GPT models for chat and reasoning.' },
    { id: 'anthropic', name: 'Anthropic', description: 'Claude models for long context assistants.' },
    { id: 'google', name: 'Google', description: 'Gemini models for multimodal workflows.' },
    { id: 'mistral', name: 'Mistral', description: 'European open-weight and proprietary models.' },
    { id: 'ollama', name: 'Ollama', description: 'Self-hosted local models through Ollama.' }
];
