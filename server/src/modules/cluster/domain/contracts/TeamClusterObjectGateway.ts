/**
 * Re-export shim. The canonical team-cluster object gateway payload types now
 * live in the neutral `shared/contracts` layer (detachable-modules migration).
 * Existing `@modules/cluster/domain/contracts/TeamClusterObjectGateway`
 * importers keep working unchanged.
 */
export type {
    TeamClusterObjectGatewayListRequest,
    TeamClusterObjectGatewayListEntry,
    TeamClusterObjectGatewayListResponse,
    TeamClusterObjectGatewayHeadResponse,
    TeamClusterObjectGatewayStreamResponse,
    TeamClusterObjectGatewayPutRequest,
    TeamClusterObjectGatewayPutStreamRequest,
    TeamClusterObjectGatewayPutBufferRequest,
    TeamClusterObjectGatewayComposeRequest
} from '@shared/contracts/types/TeamClusterObjectGateway';
