import { useEffect, useMemo } from 'react';
import useTrajectoryStore from '@/stores/trajectories';
import useConfigurationStore from '@/stores/editor/configuration';
import useTimestepStore from '@/stores/editor/timesteps';
import useLogger from '@/hooks/core/use-logger';
import type { Scene3DRef } from '@/components/organisms/Scene3D';

const savedRegistry = new Map<string, number>();
const pendingTimeouts = new Map<string, number>();
const inFlight = new Set<string>();

const stableKey = (v: any) => {
    if(!v) return '';
    if(typeof v === 'string') return v;
    
    try{
        if(v instanceof URL){
            return v.href;
        }
    }catch{}

    if(typeof v === 'object'){
        if(typeof v.url === 'string') return v.url;
        if(typeof v.src === 'string') return v.src;
        if(typeof v.href === 'string') return v.href;
        if(typeof v.id === 'string' || typeof v.id === 'number') return String(v.id);
    }

    const s = typeof v === 'object' ? JSON.stringify(v, Object.keys(v).sort()) : String(v);
    let h = 5381;
    for(let i = 0; i < s.length; i++){
        h = ((h << 5) + h) ^ s.charCodeAt(i);
    }
    return (h >>> 0).toString(36);
};

interface AutoPreviewSaverProps{
    scene3DRef: React.RefObject<Scene3DRef>;
    delay?: number;
    trajectoryId: string;
    cooldownMs?: number;
}

const AutoPreviewSaver: React.FC<AutoPreviewSaverProps> = ({
    scene3DRef,
    trajectoryId,
    delay = 100,
    cooldownMs = 30000,
}) => {
    const logger = useLogger('auto-preview-saver');
    const saveTrajectoryPreview = useTrajectoryStore((state) => state.saveTrajectoryPreview);
    const isSavingPreview = useTrajectoryStore((state) => state.isSavingPreview);
    const isModelLoading = useConfigurationStore((state) => state.isModelLoading);
    const currentGlbUrl = useTimestepStore((state) => state.currentGlbUrl);

    const glbKey = useMemo(() => stableKey(currentGlbUrl), [currentGlbUrl]);

    useEffect(() => {
        logger.log('Mounted');
        return () => {
            if(!trajectoryId) return;
            if(!glbKey) return;
            if(isModelLoading) return;
            if(isSavingPreview) return;
            if(!scene3DRef.current) return;

            const key = `${trajectoryId}|${glbKey}`;
            if(inFlight.has(key)){
                logger.log('Skip auto-save: in-flight', key);
                return;
            }

            const now = Date.now();
            const last = savedRegistry.get(key) ?? 0;
            if(now - last < cooldownMs){
                logger.log('Skip auto-save due to cooldown:', key);
                return;
            }

            const existing = pendingTimeouts.get(key);
            if(existing){
                clearTimeout(existing);
                pendingTimeouts.delete(key);
            }

            savedRegistry.set(key, now);
            inFlight.add(key);
            logger.log('Auto-saving on unmount for key:', key);

            const tid = window.setTimeout(async () => {
                try{
                    await scene3DRef.current!.waitForVisibleFrame();
                    const dataURL = await scene3DRef.current!.captureScreenshot({
                        width: 800,
                        height: 600,
                        format: 'png',
                        quality: 0.8,
                        zoomFactor: 0.8,
                    });
                    await saveTrajectoryPreview(trajectoryId, dataURL);
                }catch(error){
                    logger.warn('Failed to auto-save on unmount:', error);
                }finally{
                    inFlight.delete(key);
                    pendingTimeouts.delete(key);
                }
            }, delay);

            pendingTimeouts.set(key, tid);
        };
    }, [
        trajectoryId,
        glbKey,
        isModelLoading,
        isSavingPreview,
        scene3DRef,
        saveTrajectoryPreview,
        logger,
        delay,
        cooldownMs,
    ]);

    return null;
};

export default AutoPreviewSaver;
