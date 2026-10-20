import type { CommandResult } from '@voltstack/daemon-cluster-client';
import type { JsonValue } from '@shared/contracts/types/json';

export interface AuthenticatedMessageContext {
    daemonPassword: string;
    teamClusterId: string;
}

export type AuthenticatedReverseChannelMessage<TType extends string, TPayload extends object> =
    AuthenticatedMessageContext
    & TPayload
    & { type: TType };

type ReverseChannelPayloadValue = JsonValue;

export interface ReverseChannelCommandPayloadView {
    requestId?: string;
    [key: string]: ReverseChannelPayloadValue | undefined;
}

export type ReverseChannelCommandResult = CommandResult<object | null>;

export type ReverseChannelCommandExecutor = (
    payload: object | undefined
) => Promise<ReverseChannelCommandResult>;
