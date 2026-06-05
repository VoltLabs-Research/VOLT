import type { ITeamClusterCredentialsCipher } from '@modules/cluster/domain/port/ITeamClusterCredentialsCipher';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { decrypt, encrypt } from '@shared/infrastructure/utilities/crypto';


@Singleton(CLUSTER_TOKENS.TeamClusterCredentialsCipher)
export default class TeamClusterCredentialsCipher implements ITeamClusterCredentialsCipher {
    async encrypt(value: string): Promise<string> {
        return encrypt(value);
    }

    async decrypt(value: string): Promise<string> {
        return decrypt(value);
    }
}
