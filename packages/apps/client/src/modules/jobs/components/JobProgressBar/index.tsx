import { ProgressBar, cn } from '@heroui/react';

interface JobProgressBarProps {
    // 0..1; without one the bar only shows that work is going on.
    value?: number;
    label: string;
    className?: string;
}

// A thin bar for work a plugin reports on: filled to its value, or moving while it has given none.
const JobProgressBar = ({ value, label, className }: JobProgressBarProps) => (
    <ProgressBar
        className={cn('w-full', className)}
        size='sm'
        aria-label={label}
        {...(value === undefined ? { isIndeterminate: true } : { value: Math.round(value * 1000) / 10 })}
    >
        <ProgressBar.Track>
            <ProgressBar.Fill />
        </ProgressBar.Track>
    </ProgressBar>
);

export default JobProgressBar;
