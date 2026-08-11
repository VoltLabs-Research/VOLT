import { cn } from '@heroui/react';

type ClusterDotTone = 'success' | 'warning' | 'danger' | 'neutral';

interface ClusterStatusDotProps {
    tone: ClusterDotTone;
    pulse?: boolean;
    glow?: boolean;
    label?: string;
};

const ClusterStatusDot = ({ tone, pulse = false, glow = false, label }: ClusterStatusDotProps) => (
    <span
        className={cn(
            'relative inline-block size-2 shrink-0 rounded-full shadow-[0_0_0_2px_var(--surface-secondary)]',
            {
                success: 'bg-success text-success',
                warning: 'bg-warning text-warning',
                danger: 'bg-danger text-danger',
                neutral: 'bg-muted text-muted'
            }[tone],
            pulse && 'animate-[pulse_1.5s_ease-in-out_infinite]',
            glow && "after:pointer-events-none after:absolute after:-inset-1 after:rounded-full after:bg-current after:opacity-0 after:content-[''] after:animate-[pulse_1.8s_ease-in-out_infinite]"
        )}
        role='status'
        aria-label={label ?? `${tone} status`}
    />
);

export default ClusterStatusDot;
