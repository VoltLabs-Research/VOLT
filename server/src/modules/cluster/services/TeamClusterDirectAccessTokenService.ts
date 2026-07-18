import jwt from 'jsonwebtoken';
import { Singleton } from '@shared/infrastructure/di/decorators';
import type { Secret, SignOptions } from 'jsonwebtoken';
import type {
    DirectAccessRequesterKind,
    TeamClusterDirectAccessTokenClaims
} from '@modules/cluster/contracts/TeamClusterDirectAccessToken';
export type { DirectAccessRequesterKind, TeamClusterDirectAccessTokenClaims };

const SIGN_OPTIONS: SignOptions = {
    algorithm: 'HS256'
};

@Singleton()
export default class TeamClusterDirectAccessTokenService {
    create(secret: string, claims: TeamClusterDirectAccessTokenClaims): string {
        return jwt.sign(claims, secret as Secret, SIGN_OPTIONS);
    }

    verify(secret: string, token: string): TeamClusterDirectAccessTokenClaims | null {
        try {
            return jwt.verify(token, secret as Secret) as TeamClusterDirectAccessTokenClaims;
        } catch {
            return null;
        }
    }
}
