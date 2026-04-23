import type { ITeamClusterCredentialsCipher } from '@modules/team-cluster/domain/port/ITeamClusterCredentialsCipher';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { decrypt, encrypt } from '@shared/infrastructure/utilities/crypto';


@Singleton()
export default class TeamClusterCredentialsCipher implements ITeamClusterCredentialsCipher {
    async encrypt(value: string): Promise<string> {
        return encrypt(value);
    }

    async decrypt(value: string): Promise<string> {
        return decrypt(value);
    }
};
