import type { TeamClusterServiceExposureAccessMode } from '@voltstack/daemon-cluster-client';

export interface ObjectGatewayDirectAccessClaims {
    ownerClusterId: string;
    exposureId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export interface ObjectGatewaySecurity {
    verifyDirectAccessToken?: (token: string) => Promise<ObjectGatewayDirectAccessClaims | null>;
}
