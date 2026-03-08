import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/services/AIToolService';
import type { IUseCase, UseCaseInput, UseCaseOutput } from '@shared/application/IUseCase';
import type { z } from 'zod';

export interface TeamAIToolListResult<TData> {
    summary: string;
    data: TData;
};

export abstract class TeamUseCaseAITool<
    TInput extends Record<string, unknown>,
    TUseCase extends IUseCase<unknown, unknown, unknown>,
    TSchema extends z.ZodType<TInput> = z.ZodType<TInput>,
    TResult = UseCaseOutput<TUseCase>
> extends AITool<TInput, TResult, TSchema> {
    protected constructor(
        protected override readonly useCase: TUseCase,
        protected readonly mapInput: (
            params: TInput,
            scope: AIToolScope
        ) => UseCaseInput<TUseCase>,
        protected readonly mapOutput: (
            output: UseCaseOutput<TUseCase>,
            params: TInput,
            scope: AIToolScope
        ) => TResult
    ) {
        super();
    }

    async execute(params: TInput, scope: AIToolScope): Promise<TResult> {
        const result = await this.useCase.execute(this.mapInput(params, scope));
        if (!result.success) {
            throw result.error;
        }

        return this.mapOutput(result.value as UseCaseOutput<TUseCase>, params, scope);
    }
};
