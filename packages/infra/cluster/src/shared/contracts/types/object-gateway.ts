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

// Objects a read can bring into existence, such as models still stored in a previous format.
export interface MissingObjectResolver {
    /** Resolves true when the object exists now and did not before. */
    convertMissing(bucket: string, objectKey: string): Promise<boolean>;
    /** Removes what stands in for a missing object; resolves true when it removed something. */
    removeMissing(bucket: string, objectKey: string): Promise<boolean>;
}
