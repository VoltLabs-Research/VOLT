import { Button, cn } from '@heroui/react';
import { AlertTriangle, X } from 'lucide-react';
import { useTrajectoryUploadProgressStore } from '@/modules/trajectory/store/use-trajectory-upload-progress-store';
import { formatSize } from '@/shared/utils/format';

const toPercent = (progress: number): number => Math.min(100, Math.max(0, Math.round(progress * 100)));

const buildProgressValueText = (loadedBytes: number, totalBytes: number, percent: number): string => {
    if (totalBytes <= 0) {
        return `${percent}%`;
    }

    return `${formatSize(loadedBytes)} of ${formatSize(totalBytes)} uploaded (${percent}%)`;
};

const TrajectoryUploadProgressPanel = () => {
    const uploads = useTrajectoryUploadProgressStore((state) => state.uploads);
    const removeUpload = useTrajectoryUploadProgressStore((state) => state.removeUpload);

    if (uploads.length === 0) {
        return null;
    }

    return (
        <div className='fixed right-4 bottom-4 z-[45] flex max-h-[min(18rem,calc(100vh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-surface p-3 max-[640px]:right-3 max-[640px]:bottom-3 max-[640px]:w-[calc(100vw-1.5rem)]' role='region' aria-label='Active trajectory uploads' aria-live='polite'>
            {uploads.map((upload) => {
                const percent = toPercent(upload.progress);
                const valueText = buildProgressValueText(upload.loadedBytes, upload.totalBytes, percent);
                const hasError = Boolean(upload.error);

                return (
                    <div className={cn('flex min-w-0 flex-col gap-[0.35rem] px-3 py-2.5', hasError && 'rounded-lg border border-danger/40 bg-danger-soft')}
                        key={upload.id}
                        title={hasError ? upload.error : valueText}
                    >
                        <div className='flex flex-row items-center justify-between gap-3'>
                            <span className='min-w-0 truncate text-sm font-semibold leading-[1.25] text-foreground' title={upload.name}>
                                {upload.name}
                            </span>
                            {hasError ? (
                                <Button
                                    isIconOnly
                                    variant='ghost'
                                    size='sm'
                                    aria-label='Dismiss failed upload'
                                    onPress={() => removeUpload(upload.id)}
                                >
                                    <X size={14} />
                                </Button>
                            ) : (
                                <span className='shrink-0 text-xs font-bold leading-none tabular-nums text-muted'>{percent}%</span>
                            )}
                        </div>
                        {hasError && (
                            <div className='flex min-w-0 flex-row items-start gap-[0.35rem] text-danger'>
                                <AlertTriangle size={13} aria-hidden='true' />
                                <span className='text-xs'>
                                    {upload.error}
                                </span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default TrajectoryUploadProgressPanel;
