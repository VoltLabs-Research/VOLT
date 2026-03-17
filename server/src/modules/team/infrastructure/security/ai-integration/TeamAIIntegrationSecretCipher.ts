import type { ITeamAIIntegrationSecretCipher } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationSecretCipher';
import { decrypt, encrypt } from '@shared/infrastructure/utilities/crypto';
import { injectable } from 'tsyringe';

@injectable()
export default class TeamAIIntegrationSecretCipher implements ITeamAIIntegrationSecretCipher {
    async encrypt(value: string): Promise<string> {
        return encrypt(value);
    }

    async decrypt(value: string): Promise<string> {
        return decrypt(value);
    }
};
