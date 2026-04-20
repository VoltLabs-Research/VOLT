import type { TeamClusterServiceExposureAccessMode } from '@/core/runtime/contracts/service-exposure';

export interface ObjectGatewayDirectAccessClaims {
    ownerClusterId: string;
    exposureId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export interface ObjectGatewaySecurity {
    verifyDirectAccessToken?: (token: string) => ObjectGatewayDirectAccessClaims | null;
}
