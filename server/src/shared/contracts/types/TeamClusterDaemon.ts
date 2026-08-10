import {
    REVERSE_CHANNEL,
    type TeamClusterDaemonResponseType as ResponseTypeWire
} from '@voltstack/daemon-cluster-client';

/** Response type enum owned by the daemon-cluster SDK, re-exported under the historical name. */
export const TeamClusterDaemonResponseType = REVERSE_CHANNEL.ResponseType;
export type TeamClusterDaemonResponseType = ResponseTypeWire;
