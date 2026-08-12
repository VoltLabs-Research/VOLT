import { presentToolCall, resolveToolActionPhase } from '@/modules/ai/utils/tool-presentation';
import { resolveImagePayload } from '@/modules/ai/utils/message-artifacts';
import { Button, cn } from '@heroui/react';
import type { ToolActionPhase } from '@/modules/ai/utils/tool-presentation';
import type { ToolInvocation } from '@/modules/ai/utils/message-segments';
import type { ToolApprovalResponseParams } from '@/modules/ai/contracts/tools';

type PhaseTone = 'warning' | 'success' | 'danger';

const PHASE_TONE: Record<ToolActionPhase, PhaseTone> = {
    requested: 'warning',
    running: 'warning',
    done: 'success',
    failed: 'danger'
};

const REJECTION_REASON = 'User rejected the action.';

interface ToolInvocationCardProps {
    invocation: ToolInvocation;
    addToolApprovalResponse?: (params: ToolApprovalResponseParams) => void;
}

const ToolInvocationCard = ({ invocation, addToolApprovalResponse }: ToolInvocationCardProps) => {
    const phase = resolveToolActionPhase(invocation.state);
    const tone = PHASE_TONE[phase];
    const image = resolveImagePayload(invocation.result);

    const createApprovalHandler = (approved: boolean) => () => {
        if (!addToolApprovalResponse) return;

        const reason = approved ? undefined : REJECTION_REASON;
        const approvalId = invocation.approvalId || invocation.toolCallId;

        addToolApprovalResponse({
            id: approvalId,
            approved,
            reason
        });

        if (approvalId !== invocation.toolCallId) {
            addToolApprovalResponse({
                id: invocation.toolCallId,
                approved,
                reason
            });
        }
    };

    return (
        <div className='flex flex-col gap-1.5 border-l-2 border-border py-2 pr-0 pl-3 transition-colors duration-200 [.ai-floating-assistant_&]:p-2'>
            <div className='flex flex-row items-center gap-2 leading-[1.35]'>
                <span
                    className={cn('size-2 shrink-0 rounded-full shadow-[0_0_0_2px_var(--surface-secondary)]', {
                        warning: 'bg-warning',
                        success: 'bg-success',
                        danger: 'bg-danger'
                    }[tone])}
                    role='status'
                    aria-label={`${tone} status`}
                />
                <p className='text-xs text-muted'>
                    {presentToolCall(invocation.toolName, phase, invocation.result)}
                </p>
            </div>

            {phase === 'requested' && addToolApprovalResponse && (
                <div className='mt-0.5 flex flex-row items-center gap-1 [.ai-floating-assistant_&]:flex-wrap'>
                    <Button
                        variant='secondary'
                        size='sm'
                        className='text-success'
                        onPress={createApprovalHandler(true)}
                    >
                        Approve
                    </Button>
                    <Button
                        variant='ghost'
                        size='sm'
                        className='text-danger'
                        onPress={createApprovalHandler(false)}
                    >
                        Reject
                    </Button>
                </div>
            )}

            {phase === 'running' && (
                <div className='mt-0.5 flex flex-row items-center gap-1 [.ai-floating-assistant_&]:flex-wrap'>
                    <p className='text-xs text-muted'>
                        Running...
                    </p>
                </div>
            )}

            {image && (
                <a
                    href={image.url}
                    target='_blank'
                    rel='noreferrer'
                    className='mt-2 block overflow-hidden rounded-lg leading-none'
                >
                    <img
                        src={image.url}
                        alt={image.summary ?? 'Rendered scene'}
                        className='block h-auto max-w-full rounded-lg border border-[rgba(255,255,255,0.08)]'
                        loading='lazy'
                    />
                </a>
            )}
        </div>
    );
};

export default ToolInvocationCard;
