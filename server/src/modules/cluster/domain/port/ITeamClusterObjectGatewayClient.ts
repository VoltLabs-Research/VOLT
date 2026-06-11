import type {
    TeamClusterObjectGatewayHeadResponse,
    TeamClusterObjectGatewayListEntry,
    TeamClusterObjectGatewayListResponse,
    TeamClusterObjectGatewayStreamResponse,
    TeamClusterObjectGatewayListRequest,
    TeamClusterObjectGatewayComposeRequest,
    TeamClusterObjectGatewayPutBufferRequest,
    TeamClusterObjectGatewayPutStreamRequest
} from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';

interface TeamClusterObjectGatewayReadOptions {
    skipMetadata?: boolean;
    rangeHeader?: string;
}

export interface ITeamClusterObjectGatewayClient {
    list(
        teamClusterId: string,
        request: TeamClusterObjectGatewayListRequest
    ): Promise<TeamClusterObjectGatewayListResponse>;
    listAllEntries(
        teamClusterId: string,
        request: Omit<TeamClusterObjectGatewayListRequest, 'cursor'>
    ): AsyncIterable<TeamClusterObjectGatewayListEntry>;
    listAll(
        teamClusterId: string,
        request: Omit<TeamClusterObjectGatewayListRequest, 'cursor'>
    ): AsyncIterable<string>;
    head(teamClusterId: string, bucket: string, objectKey: string): Promise<TeamClusterObjectGatewayHeadResponse>;
    exists(teamClusterId: string, bucket: string, objectKey: string): Promise<boolean>;
    getStream(
        teamClusterId: string,
        bucket: string,
        objectKey: string,
        options?: TeamClusterObjectGatewayReadOptions
    ): Promise<TeamClusterObjectGatewayStreamResponse>;
    getBuffer(teamClusterId: string, bucket: string, objectKey: string): Promise<Buffer>;
    putStream(teamClusterId: string, request: TeamClusterObjectGatewayPutStreamRequest): Promise<void>;
    putBuffer(teamClusterId: string, request: TeamClusterObjectGatewayPutBufferRequest): Promise<void>;
    composeObject(teamClusterId: string, request: TeamClusterObjectGatewayComposeRequest): Promise<void>;
    deleteObject(teamClusterId: string, bucket: string, objectKey: string): Promise<void>;
    deleteByPrefix(teamClusterId: string, bucket: string, prefix: string): Promise<number | undefined>;
}
