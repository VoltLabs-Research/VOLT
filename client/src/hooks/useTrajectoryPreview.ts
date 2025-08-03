import { useCallback, useEffect, useMemo, useRef } from 'react';
import useTrajectoryStore from '@/stores/trajectories';
import type { Scene3DRef } from '@/components/organisms/Scene3D';

const useTrajectoryPreview = (trajectoryId: string) => {
    const getTrajectoryPreviewUrl = useTrajectoryStore((state) => state.getTrajectoryPreviewUrl);
    const saveTrajectoryPreview = useTrajectoryStore((state) => state.saveTrajectoryPreview);
    const isSavingPreview = useTrajectoryStore((state) => state.isSavingPreview);

    const scene3DRef = useRef<Scene3DRef>(null);
    const hasAutoSavedRef = useRef(false);

    const previewUrl = useMemo(() => {
        if(!trajectoryId) return null;
        return getTrajectoryPreviewUrl(trajectoryId);
    }, [trajectoryId, getTrajectoryPreviewUrl]);
    
    const autoSavePreview = useCallback(async () => {
        if(!trajectoryId || !scene3DRef.current || hasAutoSavedRef.current || isSavingPreview){
            return;
        }

        hasAutoSavedRef.current = true;
        console.log('Auto-saving trajectory preview...');
        const dataURL = await scene3DRef.current.captureScreenshot({
            width: 800,
            height: 600,
            format: 'png',
            quality: 0.85,
            download: false,
            zoomFactor: 0.8
        });

        // TODO: try-catch, result { success }, ...?
        await saveTrajectoryPreview(trajectoryId, dataURL);
    }, [trajectoryId, saveTrajectoryPreview, isSavingPreview]);

    useEffect(() => {
        hasAutoSavedRef.current = false;
    }, [trajectoryId]);

    useEffect(() => {
        return () => {
            // Only auto-save if there is a trajectory and it has not been saved already
            if(trajectoryId && !hasAutoSavedRef.current){
                // Use setTimeout to ensure the canvas is still available
                setTimeout(() => {
                    autoSavePreview();
                }, 100);
            }
        };
    }, [trajectoryId, autoSavePreview]);

    return {
        scene3DRef,
        previewUrl,
        autoSavePreview,
        isSavingPreview,
        hasPreview: !!previewUrl
    }
};

export default useTrajectoryPreview;