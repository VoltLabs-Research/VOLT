import type { CommandResult } from '@voltstack/daemon-cluster-client';
import type { JsonValue } from '@shared/contracts/types/json';

type ReverseChannelPayloadValue = JsonValue;

export interface ReverseChannelCommandPayloadView {
    requestId?: string;
    [key: string]: ReverseChannelPayloadValue | undefined;
}

export type ReverseChannelCommandResult = CommandResult<object | null>;

export type ReverseChannelCommandExecutor = (
    payload: object | undefined
) => Promise<ReverseChannelCommandResult>;
