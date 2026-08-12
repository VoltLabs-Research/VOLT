import type { CommandResult, HandlerContext } from './types';

export interface ReverseChannelHandler<TPayload = unknown, TResult = unknown> {
    handle(
        payload: TPayload,
        context: HandlerContext
    ): Promise<CommandResult<TResult>> | CommandResult<TResult>;
};
