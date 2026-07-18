/**
 * Re-export shim. Canonical cluster object-gateway signed-access types now live
 * in the neutral `shared/contracts` layer (detachable-modules migration).
 * Existing `@modules/cluster/contracts/ClusterObjectGateway` importers
 * keep working unchanged.
 */
export type {
    ClusterObjectOperation,
    ClusterObjectAccessClaims,
    ClusterObjectSignedUrl
} from '@shared/contracts/types/ClusterObjectGateway';
