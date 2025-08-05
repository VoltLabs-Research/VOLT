import { useEffect, useRef } from 'react';
import useTrajectoryStore from '@/stores/trajectories';
import useConfigurationStore from '@/stores/editor/configuration';
import useTimestepStore from '@/stores/editor/timesteps';
import type { Scene3DRef } from '@/components/organisms/Scene3D';

interface AutoPreviewSaverProps{
    scene3DRef: React.RefObject<Scene3DRef>;
    delay?: number;
    trajectoryId: string;
}

const AutoPreviewSaver: React.FC<AutoPreviewSaverProps> = ({
    scene3DRef,
    trajectoryId,
    delay = 3000,
}) => {
    const saveTrajectoryPreview = useTrajectoryStore((state) => state.saveTrajectoryPreview);
    const isSavingPreview = useTrajectoryStore((state) => state.isSavingPreview);
    const isModelLoading = useConfigurationStore((state) => state.isModelLoading);
    const currentGlbUrl = useTimestepStore((state) => state.currentGlbUrl);
    
    const hasAutoSavedRef = useRef(false);
    const timeoutIdRef = useRef<number | null>(null);

    useEffect(() => {
        hasAutoSavedRef.current = false;
        if(timeoutIdRef.current){
            clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
        }
        console.log('AutoPreviewSaver: Reset for trajectory:', trajectoryId);
    }, [trajectoryId]);

    useEffect(() => {
        if(!trajectoryId || !scene3DRef.current || !currentGlbUrl){
            return;
        }

        if(isModelLoading){
            console.log('Model is still loading, waiting...');
            return;
        }

        // If we already saved, do nothing
        if(hasAutoSavedRef.current || isSavingPreview){
            return;
        }

        console.log('Model loaded, setting up auto-save timer...');

        if(timeoutIdRef.current){
            clearTimeout(timeoutIdRef.current);
        }

        timeoutIdRef.current = setTimeout(async () => {
            if(hasAutoSavedRef.current || isSavingPreview) return;

            try{
                hasAutoSavedRef.current = true;
                console.log('Auto-saving preview after model loaded...');
                
                const dataURL = await scene3DRef.current!.captureScreenshot({
                    width: 800,
                    height: 600,
                    format: 'png',
                    quality: 0.85,
                    zoomFactor: 0.8
                });
                
                await saveTrajectoryPreview(trajectoryId, dataURL);
            }catch(error){
                console.error('Error auto-saving preview:', error);
                hasAutoSavedRef.current = false;
            }
        }, delay);

        // Cleanup function
        return () => {
            if(timeoutIdRef.current){
                clearTimeout(timeoutIdRef.current);
                timeoutIdRef.current = null;
            }
        };

    }, [trajectoryId, delay, saveTrajectoryPreview, isSavingPreview, isModelLoading, currentGlbUrl]);

    useEffect(() => {
        return () => {
            console.log('Cleaning up AutoPreviewSaver...');

            if(timeoutIdRef.current){
                clearTimeout(timeoutIdRef.current);
            }

            // Only auto-save on unmount if:
            // There is a trajectoryId, it hasn't been saved yet, the model isn't loading
            // and there is a GLB URL (the model is loaded)
            if(
                trajectoryId && 
                !hasAutoSavedRef.current && 
                !isModelLoading && 
                currentGlbUrl &&
                scene3DRef.current && 
                !isSavingPreview
            ){
                console.log('Auto-saving on unmount after model was loaded...');
                setTimeout(async () => {
                    try{
                        // TODO: duplicated code
                        const dataURL = await scene3DRef.current!.captureScreenshot({
                            width: 800,
                            height: 600,
                            format: 'png',
                            quality: 0.8,
                            zoomFactor: 0.8
                        });
                        
                        await saveTrajectoryPreview(trajectoryId, dataURL);
                    }catch(error){
                        console.warn('Failed to auto-save on unmount:', error);
                    }
                }, 100);
            }
        };
    }, [trajectoryId, isModelLoading, currentGlbUrl, isSavingPreview]);

    return null;
};

export default AutoPreviewSaver;