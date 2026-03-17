import { injectable } from 'tsyringe';
import { encrypt, decrypt } from '@shared/infrastructure/utilities/crypto';
import { ISSHCredentialsCipher } from '@modules/ssh/domain/port/ISSHCredentialsCipher';

@injectable()
export default class SSHCredentialsCipher implements ISSHCredentialsCipher {
    async encrypt(value: string): Promise<string> {
        return encrypt(value);
    }

    async decrypt(value: string): Promise<string> {
        return decrypt(value);
    }
}
