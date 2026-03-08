import { tool } from 'ai';
import type { Tool } from 'ai';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import type { UseCaseInstance } from '@shared/application/IUseCase';

type ToolDefinition = Parameters<typeof tool>[0];

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
        const toolDefinition: Record<string, unknown> = {
            description: this.description,
            inputSchema: resolvedInputSchema
        };

        if (this.needsApproval !== undefined) {
            toolDefinition.needsApproval = this.needsApproval as unknown;
        }

        if (customExecute) {
            toolDefinition.execute = async (params: TInput) => {
                return customExecute.call(this, params, scope);
            };
        } else if (this.useCase) {
            const useCase = this.useCase;
            toolDefinition.execute = async (params: TInput) => {
                const result = await useCase.execute(Object.assign({}, params, scope));
                if (!result.success) {
                    throw result.error;
                }

                return result.value;
            };
        } else {
            throw new Error(`AI tool "${this.name}" requires an execute method or a use case.`);
        }

        return {
            [this.name]: tool(toolDefinition as unknown as ToolDefinition)
        };
    }
}
