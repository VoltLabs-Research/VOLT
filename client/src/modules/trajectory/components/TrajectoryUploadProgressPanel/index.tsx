import { cn } from '@heroui/react';
import { Button } from '@voltstack/bravais';
import { AlertTriangle, X } from 'lucide-react';
import { useTrajectoryUploadProgressStore } from '@/modules/trajectory/store/use-trajectory-upload-progress-store';
import { formatSize } from '@/shared/utils/format';
import './TrajectoryUploadProgressPanel.css';

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
        <div className='flex flex-col gap-2 trajectory-upload-progress-panel bg-surface border border-border' role='region' aria-label='Active trajectory uploads' aria-live='polite'>
            {uploads.map((upload) => {
                const percent = toPercent(upload.progress);
                const valueText = buildProgressValueText(upload.loadedBytes, upload.totalBytes, percent);
                const hasError = Boolean(upload.error);

                return (
                    <div className={cn('flex flex-col gap-[0.35rem]', `trajectory-upload-progress-item${hasError ? ' trajectory-upload-progress-item--failed' : ''}`)}
                        key={upload.id}
                        title={hasError ? upload.error : valueText}
                    >
                        <div className='flex flex-row items-center justify-between gap-3'>
                            <span className='truncate trajectory-upload-progress-name' title={upload.name}>
                                {upload.name}
                            </span>
                            {hasError ? (
                                <Button
                                    variant='ghost'
                                    intent='neutral'
                                    size='sm'
                                    shape='rounded'
                                    aria-label='Dismiss failed upload'
                                    leftIcon={<X size={14} />}
                                    onClick={() => removeUpload(upload.id)}
                                />
                            ) : (
                                <span className='trajectory-upload-progress-value'>{percent}%</span>
                            )}
                        </div>
                        {hasError && (
                            <div className='flex flex-row items-start gap-[0.35rem] trajectory-upload-progress-error'>
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
