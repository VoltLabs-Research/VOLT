import { Row, Stack, Text } from '@voltstack/bravais';
import { useTrajectoryUploadProgressStore } from '@/modules/trajectory/stores/use-trajectory-upload-progress-store';
import { formatSize } from '@/shared/utils/format';
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

    if (uploads.length === 0) {
        return null;
    }

    return (
        <Stack gap='05' className='trajectory-upload-progress-panel glass-bg' role='region' aria-label='Active trajectory uploads' aria-live='polite'>
            {uploads.map((upload) => {
                const percent = toPercent(upload.progress);
                const valueText = buildProgressValueText(upload.loadedBytes, upload.totalBytes, percent);

                return (
                    <Stack key={upload.id} gap='035' className='trajectory-upload-progress-item' title={valueText}>
                        <Row justify='between' gap='075'>
                            <Text as='span' truncate className='trajectory-upload-progress-name' title={upload.name}>
                                {upload.name}
                            </Text>
                            <Text as='span' className='trajectory-upload-progress-value'>{percent}%</Text>
                        </Row>
                    </Stack>
                );
            })}
        </Stack>
    );
};

export default TrajectoryUploadProgressPanel;
