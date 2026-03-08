import { inject, injectable } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import type { ITeamAIIntegrationSecretCipher } from '@modules/team/domain/port/ITeamAIIntegrationSecretCipher';

@injectable()
export default class TeamAIIntegrationSecretService {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationSecretCipher)
        private readonly secretCipher: ITeamAIIntegrationSecretCipher
    ) {}

    encryptApiKey(apiKey: string): string {
        const normalizedApiKey = apiKey?.trim();

        if (!normalizedApiKey) {
            throw new Error(ErrorCodes.TEAM_AI_INTEGRATION_API_KEY_REQUIRED);
        }

        return this.secretCipher.encrypt(normalizedApiKey);
    }

    decryptApiKey(encryptedApiKey?: string): string {
        if (!encryptedApiKey) {
            return '';
        }

        return this.secretCipher.decrypt(encryptedApiKey);
    }

    resolveEncryptedApiKey(apiKey?: string, fallbackEncryptedApiKey?: string): string {
        const normalizedApiKey = apiKey?.trim();

        if (normalizedApiKey) {
            return this.encryptApiKey(normalizedApiKey);
        }

        if (fallbackEncryptedApiKey) {
            return fallbackEncryptedApiKey;
        }

        return this.encryptApiKey('ollama-local');
    }
}
