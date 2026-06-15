import { Button, Row, Stack, Text } from '@voltstack/bravais';
import { AlertTriangle, X } from 'lucide-react';
import { useTrajectoryUploadProgressStore } from '@/modules/trajectory/stores/use-trajectory-upload-progress-store';
import { formatSize } from '@voltstack/bravais';
import './TrajectoryUploadProgressPanel.css';

const toPercent = (progress: number): number => {
    if (!Number.isFinite(progress)) return 0;
    return Math.min(100, Math.max(0, Math.round(progress * 100)));
};

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
        <Stack gap='05' className='trajectory-upload-progress-panel glass-bg' role='region' aria-label='Active trajectory uploads' aria-live='polite'>
            {uploads.map((upload) => {
                const percent = toPercent(upload.progress);
                const valueText = buildProgressValueText(upload.loadedBytes, upload.totalBytes, percent);
                const hasError = Boolean(upload.error);

                return (
                    <Stack
                        key={upload.id}
                        gap='035'
                        className={`trajectory-upload-progress-item${hasError ? ' trajectory-upload-progress-item--failed' : ''}`}
                        title={hasError ? upload.error : valueText}
                    >
                        <Row justify='between' gap='075' align='center'>
                            <Text as='span' truncate className='trajectory-upload-progress-name' title={upload.name}>
                                {upload.name}
                            </Text>
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
                                <Text as='span' className='trajectory-upload-progress-value'>{percent}%</Text>
                            )}
                        </Row>
                        {hasError && (
                            <Row gap='035' align='start' className='trajectory-upload-progress-error'>
                                <AlertTriangle size={13} aria-hidden='true' />
                                <Text as='span' size='sm'>
                                    {upload.error}
                                </Text>
                            </Row>
                        )}
                    </Stack>
                );
            })}
        </Stack>
    );
};

export default TrajectoryUploadProgressPanel;
