import { decrypt, encrypt } from '@shared/infrastructure/utilities/crypto';

export default class TeamClusterCredentialsCipher {
    async encrypt(value: string): Promise<string> {
        return encrypt(value);
    }

    async decrypt(value: string): Promise<string> {
        return decrypt(value);
    }
}
