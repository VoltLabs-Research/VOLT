import type { JwtPayload } from 'jsonwebtoken';
import type { TeamClusterServiceExposureAccessMode } from '@modules/cluster/contracts/TeamClusterServiceExposure';

export type DirectAccessRequesterKind = 'daemon' | 'server';

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
