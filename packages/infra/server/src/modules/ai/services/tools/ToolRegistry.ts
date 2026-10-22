import { jsonSchema, tool } from 'ai';
import type { Tool, ToolSet } from 'ai';
import type AIToolController from '@shared/ai/AIToolController';
import type { AIToolBinding } from '@shared/ai/AIToolController';
import { AIToolRunner } from '@shared/ai/tool';
import type { AIToolDefinition } from '@shared/ai/tool';
import ApplicationError from '@shared/errors/ApplicationError';
import logger from '@shared/logger';
import { ErrorCodes } from '@core/constants/error-codes';
import browserToolBridge from '@modules/ai/services/tools/BrowserToolBridge';
import { withoutRefs } from '@modules/ai/services/tools/schema-refs';
import { complaintOf } from '@modules/ai/services/tools/validation-complaint';
import type { ChatToolContext } from '@modules/ai/contracts/chat';

type AIToolControllerConstructor = new () => AIToolController;

type SdkJsonSchema = Parameters<typeof jsonSchema>[0];

type ApprovalRule = 'user-approval' | ((input: unknown) => 'user-approval' | undefined);

export interface OfferedTools {
    tools: ToolSet;
    approvals: Record<string, ApprovalRule>;
}

const isPermitted = (definition: AIToolDefinition, permissions: readonly string[]): boolean =>
    definition.permission === null || permissions.includes('*') || permissions.includes(definition.permission);

class ToolRegistry {
    #bindings = new Map<string, AIToolBinding>();

    register(controllers: readonly AIToolControllerConstructor[]): void {
        this.#bindings.clear();

        for (const Controller of controllers) {
            for (const binding of new Controller().bindings()) {
                if (this.#bindings.has(binding.definition.name)) {
                    logger.warn(`@ai-tools: duplicate tool ${binding.definition.name} in ${Controller.name}; keeping the first`);
                    continue;
                }

                this.#bindings.set(binding.definition.name, binding);
            }
        }
    }

    offered(permissions: readonly string[], context: ChatToolContext): OfferedTools {
        const permitted = [...this.#bindings.values()].filter((binding) => isPermitted(binding.definition, permissions));

        return {
            tools: Object.fromEntries(permitted.map((binding) => [binding.definition.name, this.#sdkTool(binding, context)])),
            approvals: Object.fromEntries(permitted.flatMap((binding) => {
                const rule = this.#approvalOf(binding.definition);
                return rule === null ? [] : [[binding.definition.name, rule]];
            }))
        };
    }

    // An approved card runs here rather than through the model's loop, after checking again that
    // the caller may use it and that its stored input still validates.
    async run(name: string, context: ChatToolContext, permissions: readonly string[], input: unknown, toolCallId: string, signal?: AbortSignal): Promise<unknown> {
        const binding = this.#bindings.get(name);
        if (binding === undefined || !isPermitted(binding.definition, permissions)) {
            throw ApplicationError.notFound(ErrorCodes.AI_TOOL_NOT_FOUND, `${name} is not available to this conversation`);
        }

        const validation = binding.definition.validate(input);
        if (!validation.success) throw new Error(complaintOf(name, validation.errors));

        return this.#execute(binding, context, validation.data, toolCallId, signal);
    }

    #sdkTool(binding: AIToolBinding, context: ChatToolContext): Tool {
        const { definition } = binding;

        return tool({
            description: definition.description,
            inputSchema: jsonSchema(withoutRefs(definition.parameters) as SdkJsonSchema, {
                validate: (value) => {
                    const validation = definition.validate(value);
                    return validation.success
                        ? {
                            success: true,
                            value: validation.data
                        }
                        : {
                            success: false,
                            error: new Error(complaintOf(definition.name, validation.errors))
                        };
                }
            }),
            execute: (input: unknown, { toolCallId, abortSignal }) => this.#execute(binding, context, input, toolCallId, abortSignal)
        });
    }

    #execute(binding: AIToolBinding, context: ChatToolContext, input: unknown, toolCallId: string, signal?: AbortSignal): Promise<unknown> {
        if (binding.definition.runner === AIToolRunner.Browser) {
            return browserToolBridge.invoke(context, {
                toolCallId,
                toolName: binding.definition.name,
                input
            }, signal);
        }

        return binding.handler(input as Record<string, unknown>, {
            teamId: context.teamId,
            userId: context.userId,
            currentConversationId: context.conversationId
        });
    }

    #approvalOf(definition: AIToolDefinition): ApprovalRule | null {
        const { approval } = definition;
        if (approval === false) return null;
        if (approval === true) return 'user-approval';

        return (input) => (approval(input) ? 'user-approval' : undefined);
    }
}

export default new ToolRegistry();
