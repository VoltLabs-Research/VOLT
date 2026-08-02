import { presentToolCall, resolveToolActionPhase } from '@/modules/ai/utils/tool-presentation';
import { resolveImagePayload } from '@/modules/ai/utils/message-artifacts';
import { Box, Button, Row, StatusDot, Text } from '@voltstack/bravais';
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
        <Box className='ai-action-request-card'>
            <Row gap='05' className='ai-action-request-header'>
                <StatusDot tone={PHASE_TONE[phase]} size='sm' />
                <Text as='p' size='sm' tone='muted'>
                    {presentToolCall(invocation.toolName, phase, invocation.result)}
                </Text>
            </Row>

            {phase === 'requested' && addToolApprovalResponse && (
                <Row gap='025' className='ai-action-request-controls'>
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
                </Row>
            )}

            {phase === 'running' && (
                <Row gap='025' className='ai-action-request-controls'>
                    <Text as='p' size='sm' tone='muted'>
                        Running...
                    </Text>
                </Row>
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
        </Box>
    );
};

export default ToolInvocationCard;
