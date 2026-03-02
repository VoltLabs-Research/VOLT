import { tool } from 'ai';
import type { Tool } from 'ai';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import type { UseCaseInstance } from '@shared/application/IUseCase';

export abstract class AITool<TParams extends z.ZodTypeAny = any, TResult = any> {
    abstract readonly name: string;
    abstract readonly description: string;
    /**
     * @deprecated Use `inputSchema` in new tools. Kept for backward compatibility.
     */
    abstract readonly parameters: TParams;
    readonly inputSchema?: TParams;

    /**
     * Optional UseCase to auto-invoke. When declared, the base class
     * automatically calls `useCase.execute({ ...params, ...scope })`,
     * checks the Result, and returns its value, no manual `execute`
     * override needed.
     */
    protected useCase?: UseCaseInstance;

    /**
     * When true (or a function returning true), the SDK will pause tool
     * execution and emit a `tool-approval-request` event in the stream.
     * The client must respond with a `tool-approval-response` before
     * execution proceeds. Use this for destructive operations.
     *
     * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-execution-approval
     */
    protected needsApproval?: boolean | ((params: z.infer<TParams>) => boolean | Promise<boolean>);

    /**
     * Optional execute method if the tool needs to perform a server-side action.
     * If not provided but `useCase` is set, the base class will auto-invoke the use case.
     * If neither is provided, the tool is considered definition-only (e.g., client-side handling).
     */
    execute?(params: z.infer<TParams>, scope: AIToolScope): Promise<TResult>;

    /**
     * Builds the Vercel AI SDK Tool definition.
     */
    build(scope: AIToolScope): Record<string, Tool> {
        const inputSchema = this.inputSchema ?? this.parameters;
        const toolDef: any = {
            description: this.description,
            inputSchema
        };

        if (this.needsApproval !== undefined) {
            toolDef.needsApproval = this.needsApproval;
        }

        if (this.execute) {
            toolDef.execute = async (params: z.infer<TParams>) => {
                return this.execute!(params, scope);
            };
        } else if (this.useCase) {
            const useCase = this.useCase;
            toolDef.execute = async (params: z.infer<TParams>) => {
                const result = await useCase.execute(Object.assign({}, params, scope));
                if (!result.success) throw result.error;
                return result.value;
            };
        }

        return {
            [this.name]: tool(toolDef)
        };
    }
}
