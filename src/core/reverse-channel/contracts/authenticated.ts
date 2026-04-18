export interface AuthenticatedMessageContext {
    daemonPassword: string;
    teamClusterId: string;
}

export type AuthenticatedReverseChannelMessage<TType extends string, TPayload extends object> =
    AuthenticatedMessageContext
    & TPayload
    & { type: TType };
