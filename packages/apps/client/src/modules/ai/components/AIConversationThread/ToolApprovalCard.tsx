import { describeInput, isFailedOutput, presentActivity, presentRequest } from '@/modules/ai/utils/tool-presentation';
import { Button, cn } from '@heroui/react';
import { Fragment } from 'react';
import type { ToolActivity } from '@/modules/ai/utils/message-blocks';

type VerdictTone = 'pending' | 'approved' | 'rejected' | 'failed';

const VERDICT_TONE: Record<VerdictTone, string> = {
    pending: 'text-muted',
    approved: 'text-success',
    rejected: 'text-muted',
    failed: 'text-danger'
};

interface Verdict {
    tone: VerdictTone;
    text: string;
}

const verdictOf = (activity: ToolActivity): Verdict | null => {
    const { outcome } = activity;

    switch (outcome.kind) {
        case 'awaiting':
            return null;
        case 'running':
            return {
                tone: 'pending',
                text: 'Approved. Running…'
            };
        case 'done':
            return {
                tone: isFailedOutput(outcome.output) ? 'failed' : 'approved',
                text: presentActivity(activity)
            };
        case 'failed':
            return {
                tone: 'failed',
                text: `Approved, but it failed: ${outcome.error}`
            };
        case 'declined':
            return {
                tone: 'rejected',
                text: 'Rejected. Nothing ran.'
            };
    }
};

interface ToolApprovalCardProps {
    activities: ToolActivity[];
    canDecide: boolean;
    onDecide: (approvalIds: string[], approved: boolean) => void;
}

// The calls a turn stopped to ask about. The server runs what the user approves and the turn
// carries on from there; the card stays in the transcript with what became of each call.
const ToolApprovalCard = ({ activities, canDecide, onDecide }: ToolApprovalCardProps) => {
    const awaiting = activities.flatMap(({ outcome }) => (outcome.kind === 'awaiting' ? [outcome.approvalId] : []));
    const isBatch = awaiting.length > 1;

    return (
        <section
            className='flex w-full flex-col gap-3 rounded-lg border border-border bg-surface-secondary p-3'
            aria-label={awaiting.length > 0 ? 'Volt AI is asking for approval' : 'Approval request'}
        >
            {activities.map((activity) => {
                const fields = describeInput(activity.input);
                const verdict = verdictOf(activity);

                return (
                    <div key={activity.toolCallId} className='flex min-w-0 flex-col gap-1.5'>
                        <p className='text-sm font-medium text-foreground'>{presentRequest(activity.toolName)}</p>

                        {fields.length > 0 && (
                            <dl className='m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs'>
                                {fields.map((field) => (
                                    <Fragment key={field.label}>
                                        <dt className='text-muted'>{field.label}</dt>
                                        <dd className='m-0 min-w-0 break-words text-foreground'>{field.value}</dd>
                                    </Fragment>
                                ))}
                            </dl>
                        )}

                        {verdict !== null && (
                            <p className={cn('text-xs', VERDICT_TONE[verdict.tone])} role='status'>{verdict.text}</p>
                        )}
                    </div>
                );
            })}

            {awaiting.length > 0 && (
                <div className='flex flex-row flex-wrap items-center gap-1.5'>
                    <Button
                        size='sm'
                        variant='primary'
                        isDisabled={!canDecide}
                        onPress={() => onDecide(awaiting, true)}
                    >
                        {isBatch ? `Approve all ${awaiting.length}` : 'Approve'}
                    </Button>
                    <Button
                        size='sm'
                        variant='ghost'
                        className='text-danger'
                        isDisabled={!canDecide}
                        onPress={() => onDecide(awaiting, false)}
                    >
                        {isBatch ? 'Reject all' : 'Reject'}
                    </Button>
                </div>
            )}
        </section>
    );
};

export default ToolApprovalCard;
