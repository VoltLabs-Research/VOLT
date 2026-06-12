/**
 * Re-export shim. The canonical exposure enums + `TeamClusterServiceExposure`
 * shape now live in the neutral `shared/contracts` layer (detachable-modules
 * migration). Existing
 * `@modules/cluster/domain/contracts/TeamClusterServiceExposure` importers keep
 * working unchanged, and — because these are nominal enums — stay
 * type-identical to every other consumer of the contract.
 */
export {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureStatus,
    TeamClusterServiceExposureSourceKind
} from '@shared/contracts/types/TeamClusterExposure';
export type { TeamClusterServiceExposure } from '@shared/contracts/types/TeamClusterExposure';
