import { tool } from 'ai';
import type { Tool } from 'ai';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { UseCaseInstance } from '@shared/application/IUseCase';

interface MutableToolDefinition<TInput extends Record<string, unknown>, TResult, TSchema extends z.ZodType<TInput>> {
    description: string;
    inputSchema: TSchema;
    execute: (params: TInput) => Promise<TResult>;
    needsApproval?: boolean | ((params: TInput) => boolean | Promise<boolean>);
};

export abstract class AITool<
    TInput extends Record<string, unknown> = Record<string, unknown>,
    TResult = unknown,
    TSchema extends z.ZodType<TInput> = z.ZodType<TInput>
> {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly parameters: TSchema;
    readonly inputSchema?: TSchema;

    protected useCase?: UseCaseInstance;

    protected needsApproval?: boolean | ((params: TInput) => boolean | Promise<boolean>);

    execute?(params: TInput, scope: AIToolScope): Promise<TResult>;

    build(scope: AIToolScope): Record<string, Tool> {
        const customExecute = this.execute;
        const resolvedInputSchema = this.inputSchema ?? this.parameters;
        const toolDefinition: MutableToolDefinition<TInput, TResult, TSchema> = {
            description: this.description,
            inputSchema: resolvedInputSchema,
            execute: async (params: TInput): Promise<TResult> => {
                if (customExecute) {
                    return customExecute.call(this, params, scope);
                }

                if (this.useCase) {
                    const result = await this.useCase.execute(Object.assign({}, params, scope));
                    if (!result.success) {
                        throw result.error;
                    }

                    return result.value as TResult;
                }

                throw new Error(`AI tool "${this.name}" requires an execute method or a use case.`);
            }
        };

        if (this.needsApproval !== undefined) {
            toolDefinition.needsApproval = this.needsApproval;
        }

        return {
            [this.name]: tool(toolDefinition as any)
        };
    }
};
