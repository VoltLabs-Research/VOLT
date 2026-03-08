import { tool } from 'ai';
import type { Tool } from 'ai';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { UseCaseInstance } from '@shared/application/IUseCase';

type AIToolInput<TInput> = [TInput] extends [never] ? unknown : TInput;

type AIToolNeedsApproval<TInput> = boolean | ((input: AIToolInput<TInput>) => boolean | Promise<boolean>);

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

    protected needsApproval?: AIToolNeedsApproval<TInput>;

    execute?(params: TInput, scope: AIToolScope): Promise<TResult>;

    build(scope: AIToolScope): Record<string, Tool> {
        const customExecute = this.execute;
        const resolvedInputSchema = this.inputSchema ?? this.parameters;
        const execute = async (params: TInput): Promise<TResult> => {
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
        };

        const toolDefinition = this.needsApproval === undefined
            ? {
                description: this.description,
                inputSchema: resolvedInputSchema,
                execute
            }
            : {
                description: this.description,
                inputSchema: resolvedInputSchema,
                execute,
                needsApproval: this.needsApproval
            };

        return {
            [this.name]: tool(toolDefinition as unknown as Tool<TInput, TResult>)
        };
    }
};
