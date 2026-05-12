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
        <div className='trajectory-upload-progress-panel glass-bg d-flex column gap-05' role='region' aria-label='Active trajectory uploads' aria-live='polite'>
            {uploads.map((upload) => {
                const percent = toPercent(upload.progress);
                const valueText = buildProgressValueText(upload.loadedBytes, upload.totalBytes, percent);

                return (
                    <div key={upload.id} className='trajectory-upload-progress-item d-flex column gap-035' title={valueText}>
                        <div className='d-flex items-center content-between gap-075'>
                            <span className='trajectory-upload-progress-name text-truncate' title={upload.name}>
                                {upload.name}
                            </span>
                            <span className='trajectory-upload-progress-value'>{percent}%</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default TrajectoryUploadProgressPanel;
