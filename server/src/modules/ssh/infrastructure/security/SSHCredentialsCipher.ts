import { injectable } from 'tsyringe';
import { encrypt, decrypt } from '@shared/infrastructure/utilities/crypto';
import { ISSHCredentialsCipher } from '@modules/ssh/domain/port/ISSHCredentialsCipher';

@injectable()
export default class SSHCredentialsCipher implements ISSHCredentialsCipher {
    encrypt(value: string): string {
        return encrypt(value);
    }

    decrypt(value: string): string {
        return decrypt(value);
    }
}
