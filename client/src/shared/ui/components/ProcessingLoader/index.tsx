import Loader from '@/shared/ui/components/Loader';
import { cn } from '@heroui/react';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';

interface ProcessingLoaderProps {
    message?: string;
    completionRate?: number;
    className?: string;
    isVisible: boolean;
    showProgress?: boolean;
};

const ProcessingLoader = ({
    message = 'Processing...',
    completionRate = 0,
    isVisible = true,
    className = '',
    showProgress = false
}: ProcessingLoaderProps) => {
    const prefersReducedMotion = usePrefersReducedMotion();

    if (!isVisible) return null;

    const progressPercentage = Math.min(completionRate * 100, 100);
    const statusMessage = showProgress && completionRate > 0
        ? `${message} ${Math.round(progressPercentage)}% complete.`
        : message;

    return (
        <div className={cn('flex flex-row items-center gap-3 py-2 animate-in fade-in-0 duration-300 ease-in', className)} role='status' aria-live='polite' aria-atomic='true'>
            <Loader size='sm' color='current' className='shrink-0' />
            <div className='flex flex-col gap-[0.35rem] flex-1'>
                <p className='text-muted text-[0.85rem] whitespace-nowrap text-ellipsis overflow-hidden' title={message}>{message}</p>
                <span className='sr-only hidden motion-reduce:inline'>{statusMessage}</span>
                {showProgress && completionRate > 0 && (
                    <div className='w-full overflow-hidden h-[3px] rounded-[2px] bg-border' role='progressbar' aria-label='Processing progress' aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercentage)}>
                        <div className='h-full bg-accent transition-[width] duration-300 ease-out' style={{
                            width: `${progressPercentage}%`,
                            transition: prefersReducedMotion ? 'none' : undefined
                        }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProcessingLoader;
