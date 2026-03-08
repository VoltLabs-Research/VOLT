import { injectable } from 'tsyringe';
import { encrypt, decrypt } from '@shared/infrastructure/utilities/crypto';
import { ITeamAIIntegrationSecretCipher } from '@modules/team/domain/port/ITeamAIIntegrationSecretCipher';

@injectable()
export default class TeamAIIntegrationSecretCipher implements ITeamAIIntegrationSecretCipher {
    encrypt(value: string): string {
        return encrypt(value);
    }

    decrypt(value: string): string {
        return decrypt(value);
    }
}
