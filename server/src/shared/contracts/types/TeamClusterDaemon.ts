import {
    REVERSE_CHANNEL,
    type TeamClusterDaemonResponseType as ResponseTypeWire
} from '@voltstack/daemon-cluster-client';

export const TeamClusterDaemonResponseType = REVERSE_CHANNEL.ResponseType;
export type TeamClusterDaemonResponseType = ResponseTypeWire;
