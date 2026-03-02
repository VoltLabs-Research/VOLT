import { encrypt, decrypt } from '@shared/infrastructure/utilities/crypto';
import { AI_PROVIDERS, type AIProvider } from '@modules/ai/domain/constants/AIProviders';

export const TEAM_AI_PROVIDERS = AI_PROVIDERS;
export type TeamAIProvider = AIProvider;
export type TeamAIIntegrationCreatedBy = string | { _id?: unknown; toString?: () => string };

export interface TeamAIIntegrationProps {
    team: string;
    provider: TeamAIProvider;
    encryptedApiKey: string;
    isEnabled: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
    createdBy: TeamAIIntegrationCreatedBy;
    createdAt: Date;
    updatedAt: Date;
};

export default class TeamAIIntegration {
    constructor(
        public id: string,
        public props: TeamAIIntegrationProps
    ) {}

    public static encryptApiKey(apiKey: string): string {
        if (!apiKey?.trim()) {
            throw new Error('API key cannot be empty');
        }

        return encrypt(apiKey.trim());
    }

    public static decryptApiKey(encryptedApiKey: string): string {
        if (!encryptedApiKey) {
            return '';
        }

        return decrypt(encryptedApiKey);
    }

    public setApiKey(apiKey: string): void {
        this.props.encryptedApiKey = TeamAIIntegration.encryptApiKey(apiKey);
    }

    public getApiKey(): string {
        return TeamAIIntegration.decryptApiKey(this.props.encryptedApiKey);
    }
}
