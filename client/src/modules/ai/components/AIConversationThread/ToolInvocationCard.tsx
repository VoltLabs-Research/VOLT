import { presentToolCall, resolveToolActionPhase } from '@/modules/ai/utils/tool-presentation';
import { resolveImagePayload } from '@/modules/ai/utils/message-artifacts';
import {
    ACTION_REQUEST_CARD,
    ACTION_REQUEST_CONTROLS,
    ACTION_REQUEST_HEADER,
    TOOL_IMAGE,
    TOOL_IMAGE_LINK
} from '@/modules/ai/components/AIConversationThread/thread-styles';
import { Button } from '@heroui/react';
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

/**
 * bravais's `StatusDot` at `size='sm'` (8×8) rebuilt as a span, keeping its
 * `role='status'` and its interpolated default accessible name — a naive swap would
 * change what assistive tech announces for every dot. The 2px punch-out ring is part of
 * every tone in the original and is load-bearing wherever a dot overlaps artwork.
 */
const STATUS_DOT = 'size-2 shrink-0 rounded-full shadow-[0_0_0_2px_var(--surface-secondary)]';

const STATUS_DOT_TONE: Record<PhaseTone, string> = {
    warning: 'bg-warning',
    success: 'bg-success',
    danger: 'bg-danger'
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
        <div className={ACTION_REQUEST_CARD}>
            <div className={ACTION_REQUEST_HEADER}>
                <span
                    className={`${STATUS_DOT} ${STATUS_DOT_TONE[tone]}`}
                    role='status'
                    aria-label={`${tone} status`}
                />
                <p className='text-xs text-muted'>
                    {presentToolCall(invocation.toolName, phase, invocation.result)}
                </p>
            </div>

            {phase === 'requested' && addToolApprovalResponse && (
                <div className={ACTION_REQUEST_CONTROLS}>
                    {/*
                      * bravais crossed `variant` with `intent`; `solid` + `success` had no
                      * HeroUI equivalent, so it resolves to `secondary` plus the hue, and
                      * `outline` + `danger` to `ghost` plus the hue (spec §4d).
                      */}
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
                <div className={ACTION_REQUEST_CONTROLS}>
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
                    className={TOOL_IMAGE_LINK}
                >
                    <img
                        src={image.url}
                        alt={image.summary ?? 'Rendered scene'}
                        className={TOOL_IMAGE}
                        loading='lazy'
                    />
                </a>
            )}
        </div>
    );
};

export default ToolInvocationCard;
