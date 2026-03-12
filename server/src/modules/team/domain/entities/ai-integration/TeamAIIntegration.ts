import type { AIProvider } from '@modules/ai/domain/contracts/AIProviders';

export type TeamAIProvider = AIProvider;

export interface EnabledModel {
    id: string;
    name: string;
};

type TeamAIIntegrationCreatedBy = string | { _id?: unknown; toString?: () => string };

export interface TeamAIIntegrationProps {
    team: string;
    provider: TeamAIProvider;
    encryptedApiKey: string;
    isEnabled: boolean;
    defaultModel?: string;
    enabledModels?: EnabledModel[];
    metadata?: Record<string, unknown>;
    createdBy: TeamAIIntegrationCreatedBy;
    createdAt: Date;
    updatedAt: Date;
};

export default class TeamAIIntegration {
    constructor(
        public _id: string,
        public props: TeamAIIntegrationProps
    ) {}

    public get id(): string {
        return this._id;
    }

    public getTeamId(): string {
        return TeamAIIntegration.getRefId(this.props.team);
    }

    public getCreatedById(): string {
        return TeamAIIntegration.getRefId(this.props.createdBy);
    }

    public static create(input: {
        teamId: string;
        provider: TeamAIProvider;
        encryptedApiKey: string;
        isEnabled: boolean;
        defaultModel: string;
        enabledModels: EnabledModel[];
        metadata?: Record<string, unknown>;
        userId: string;
        now?: Date;
    }): Partial<TeamAIIntegrationProps> {
        const now = input.now ?? new Date();

        return {
            team: input.teamId,
            provider: input.provider,
            encryptedApiKey: input.encryptedApiKey,
            isEnabled: input.isEnabled,
            defaultModel: input.defaultModel,
            enabledModels: TeamAIIntegration.deduplicateModels(input.enabledModels),
            metadata: input.metadata,
            createdBy: input.userId,
            createdAt: now,
            updatedAt: now
        };
    }

    public buildUpdatePayload(input: {
        encryptedApiKey: string;
        isEnabled: boolean;
        defaultModel: string;
        enabledModels: EnabledModel[];
        metadata?: Record<string, unknown>;
        now?: Date;
    }): Partial<TeamAIIntegrationProps> {
        return {
            encryptedApiKey: input.encryptedApiKey,
            isEnabled: input.isEnabled,
            defaultModel: input.defaultModel,
            enabledModels: TeamAIIntegration.deduplicateModels(input.enabledModels),
            metadata: input.metadata,
            updatedAt: input.now ?? new Date()
        };
    }

    /** Deduplicates enabled models by id, keeping the last occurrence. */
    private static deduplicateModels(models: EnabledModel[]): EnabledModel[] {
        return [...new Map(models.map((m) => [m.id, m])).values()];
    }

    private static getRefId(value: TeamAIIntegrationCreatedBy | string): string {
        if (typeof value === 'string') {
            return value;
        }

        if (typeof value._id === 'string') {
            return value._id;
        }

        return value.toString?.() ?? '';
    }
};
