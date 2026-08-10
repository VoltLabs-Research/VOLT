import { presentToolCall, resolveToolActionPhase } from '@/modules/ai/utils/tool-presentation';
import { resolveImagePayload } from '@/modules/ai/utils/message-artifacts';
import { Button, StatusDot } from '@voltstack/bravais';
import type { ToolActionPhase } from '@/modules/ai/utils/tool-presentation';
import type { ToolInvocation } from '@/modules/ai/utils/message-segments';
import type { ToolApprovalResponseParams } from '@/modules/ai/contracts/tools';

const PHASE_TONE: Record<ToolActionPhase, 'warning' | 'success' | 'danger'> = {
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
        <div className='ai-action-request-card'>
            <div className='flex flex-row items-center gap-2 ai-action-request-header'>
                <StatusDot tone={PHASE_TONE[phase]} size='sm' />
                <p className='text-xs text-muted'>
                    {presentToolCall(invocation.toolName, phase, invocation.result)}
                </p>
            </div>

            {phase === 'requested' && addToolApprovalResponse && (
                <div className='flex flex-row items-center gap-1 ai-action-request-controls'>
                    <Button
                        variant='solid'
                        intent='success'
                        size='sm'
                        onClick={createApprovalHandler(true)}
                    >
                        Approve
                    </Button>
                    <Button
                        variant='outline'
                        intent='danger'
                        size='sm'
                        onClick={createApprovalHandler(false)}
                    >
                        Reject
                    </Button>
                </div>
            )}

            {phase === 'running' && (
                <div className='flex flex-row items-center gap-1 ai-action-request-controls'>
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
                    className='ai-tool-image-link'
                >
                    <img
                        src={image.url}
                        alt={image.summary ?? 'Rendered scene'}
                        className='ai-tool-image'
                        loading='lazy'
                    />
                </a>
            )}
        </div>
    );
};

export default ToolInvocationCard;
