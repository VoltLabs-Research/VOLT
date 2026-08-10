import type { CommandResult, HandlerContext } from './types';

/**
 * Contract for handling an inbound command from the server over the reverse channel.
 *
 * Implement this interface to handle a specific `command` name.  The SDK
 * dispatches the call, wraps the result into a response envelope and sends it
 * back automatically - handlers never touch the socket directly.
 *
 * @example
 * ```typescript
 * class RuntimeHeartbeatHandler implements ReverseChannelHandler {
 *     async handle(payload: unknown, _ctx: HandlerContext): Promise<CommandResult> {
 *         return { data: { alive: true } };
 *     }
 * }
 * ```
 */
export interface ReverseChannelHandler<TPayload = unknown, TResult = unknown> {
    handle(
        payload: TPayload,
        context: HandlerContext
    ): Promise<CommandResult<TResult>> | CommandResult<TResult>;
};
