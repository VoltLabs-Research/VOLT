import type { ITeamClusterCredentialsCipher } from '@modules/team-cluster/domain/port/ITeamClusterCredentialsCipher';
import { decrypt, encrypt } from '@shared/infrastructure/utilities/crypto';
import { injectable } from 'tsyringe';

@injectable()
export default class TeamClusterCredentialsCipher implements ITeamClusterCredentialsCipher {
    encrypt(value: string): string {
        return encrypt(value);
    }

    decrypt(value: string): string {
        return decrypt(value);
    }
};
