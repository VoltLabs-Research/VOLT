import { Singleton } from '@shared/infrastructure/di/decorators';
import { decrypt, encrypt } from '@shared/infrastructure/utilities/crypto';


@Singleton()
export default class TeamAIIntegrationSecretCipher {
    async encrypt(value: string): Promise<string> {
        return encrypt(value);
    }

    async decrypt(value: string): Promise<string> {
        return decrypt(value);
    }
};
