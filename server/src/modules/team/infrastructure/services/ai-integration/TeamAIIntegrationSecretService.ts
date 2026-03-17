import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { inject, injectable } from 'tsyringe';
import type { ITeamAIIntegrationSecretCipher } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationSecretCipher';

@injectable()
export default class TeamAIIntegrationSecretService {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationSecretCipher)
        private readonly secretCipher: ITeamAIIntegrationSecretCipher
    ) {}

    async encryptApiKey(apiKey: string): Promise<string> {
        const normalizedApiKey = apiKey?.trim();

        if (!normalizedApiKey) {
            throw new Error(ErrorCodes.TEAM_AI_INTEGRATION_API_KEY_REQUIRED);
        }

        return this.secretCipher.encrypt(normalizedApiKey);
    }

    async decryptApiKey(encryptedApiKey?: string): Promise<string> {
        if (!encryptedApiKey) {
            return '';
        }

        return this.secretCipher.decrypt(encryptedApiKey);
    }

    async resolveEncryptedApiKey(apiKey?: string, fallbackEncryptedApiKey?: string): Promise<string> {
        const normalizedApiKey = apiKey?.trim();

        if (normalizedApiKey) {
            return this.encryptApiKey(normalizedApiKey);
        }

        if (fallbackEncryptedApiKey) {
            return fallbackEncryptedApiKey;
        }

        return this.encryptApiKey('ollama-local');
    }
};
