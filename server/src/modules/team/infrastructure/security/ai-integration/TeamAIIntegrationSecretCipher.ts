import type { ITeamAIIntegrationSecretCipher } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationSecretCipher';
import { decrypt, encrypt } from '@shared/infrastructure/utilities/crypto';
import { injectable } from 'tsyringe';

@injectable()
export default class TeamAIIntegrationSecretCipher implements ITeamAIIntegrationSecretCipher {
    encrypt(value: string): string {
        return encrypt(value);
    }

    decrypt(value: string): string {
        return decrypt(value);
    }
};
