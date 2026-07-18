import { tool } from 'ai';
import type { Tool } from 'ai';
import { z } from 'zod';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
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

    protected useCase?: UseCaseInstance;

    protected needsApproval?: AIToolNeedsApproval<TInput>;

    
    protected readonly clientExecuted?: boolean;

    execute?(params: TInput, scope: AIToolScope): Promise<TResult>;

    build(scope: AIToolScope): Record<string, Tool> {
        if (this.clientExecuted) {
            const clientToolDefinition = this.needsApproval === undefined
                ? {
                    description: this.description,
                    inputSchema: this.parameters
                }
                : {
                    description: this.description,
                    inputSchema: this.parameters,
                    needsApproval: this.needsApproval
                };

            return {
                [this.name]: tool(clientToolDefinition as unknown as Tool<TInput, TResult>)
            };
        }

        const customExecute = this.execute;
        const execute = async (params: TInput): Promise<TResult> => {
            if (customExecute) {
                return customExecute.call(this, params, scope);
            }

            if (this.useCase) {
                return (await this.useCase.execute(Object.assign({}, params, scope))) as TResult;
            }

            throw new Error(`AI tool "${this.name}" requires an execute method or a use case.`);
        };

        const toolDefinition = this.needsApproval === undefined
            ? {
                description: this.description,
                inputSchema: this.parameters,
                execute
            }
            : {
                description: this.description,
                inputSchema: this.parameters,
                execute,
                needsApproval: this.needsApproval
            };

        return {
            [this.name]: tool(toolDefinition as unknown as Tool<TInput, TResult>)
        };
    }
}
