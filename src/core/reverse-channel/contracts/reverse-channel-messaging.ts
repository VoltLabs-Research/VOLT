import type { CommandResult } from '@voltstack/daemon-cluster-client';
import type { JsonValue } from '@/support/types/json';

export interface AuthenticatedMessageContext {
    daemonPassword: string;
    teamClusterId: string;
}

export type AuthenticatedReverseChannelMessage<TType extends string, TPayload extends object> =
    AuthenticatedMessageContext
    & TPayload
    & { type: TType };

export type ReverseChannelPayloadValue = JsonValue;

export interface ReverseChannelCommandPayloadView {
    requestId?: string;
    [key: string]: ReverseChannelPayloadValue | undefined;
}

export type ReverseChannelCommandResult = CommandResult<object | null>;

export type ReverseChannelCommandExecutor = (
    payload: object | undefined
) => Promise<ReverseChannelCommandResult>;

type TimestepDedupeSegment = number | 'none';

const TIMESTEP_DEDUPE_SEGMENT_NONE = 'none';

export const readTimestepDedupeSegment = (timestep?: number): TimestepDedupeSegment => {
    if (timestep === undefined) {
        return TIMESTEP_DEDUPE_SEGMENT_NONE;
    }

    return timestep;
};
