import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import jwt from 'jsonwebtoken';
import { Singleton } from '@shared/infrastructure/di/decorators';

import type { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';

type DirectAccessRequesterKind = 'daemon' | 'server';

export interface TeamClusterDirectAccessTokenClaims extends JwtPayload {
    requesterKind: DirectAccessRequesterKind;
    requesterId: string;
    ownerClusterId: string;
    teamId: string;
    exposureId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    iat: number;
    exp: number;
}

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
