import React from 'react';
import type { RasterSceneProps } from '@/types/raster';
import AnalysisSelect from '@/components/atoms/raster/AnalysisSelect';
import Loader from '@/components/atoms/common/Loader';
import Button from '@/components/primitives/Button';
import { Skeleton } from '@mui/material';
import RasterSceneSkeleton from '@/components/atoms/raster/RasterSceneSkeleton';
import { AnimatePresence, motion } from 'framer-motion';
import PlaybackControls from '@/components/atoms/raster/PlaybackControls';
import ModelRail from '@/components/atoms/raster/ModelRail';
import analysisConfigApi from '@/services/api/analysis-config';
import rasterApi from '@/services/api/raster';
import trajectoryApi from '@/services/api/trajectory';
import { LuDownload } from 'react-icons/lu';
import './RasterScene.css';

const RasterScene: React.FC<RasterSceneProps> = ({
  scene,
  trajectoryId,
  disableAnimation,
  isLoading,
  playbackControls,
  analysisSelect,
  modelRail,
}) => {
  const [showUnavailable, setShowUnavailable] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [downloadProgress, setDownloadProgress] = React.useState<number | null>(null);

  React.useEffect(() => {
    setShowUnavailable(false);
  }, [scene?.frame, scene?.model, scene?.analysisId]);

  React.useEffect(() => {
    if(scene?.isUnavailable){
      const t = setTimeout(() => setShowUnavailable(true), 800);
      return () => clearTimeout(t);
    }
    setShowUnavailable(false);
  }, [scene?.isUnavailable]);

  const handleDoubleClick = () => { };

  const canDownload = !!trajectoryId;
  const handleDownloadDislocations = async() => {
    if(!scene?.analysisId) return;
    setDownloadProgress(0);
    try{
      const data = await analysisConfigApi.getDislocations(scene.analysisId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dislocations_${scene.analysisId}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    }catch(error){
      console.error('Download failed:', error);
    }finally{
      setDownloadProgress(null);
      setIsMenuOpen(false);
    }
  };
  const handleDownloadGLBZip = async() => {
    if(!trajectoryId) return;
    setDownloadProgress(0);
    try{
      // Note: downloadBlob functionality would need to be added to trajectory-api
      // For now, using inline implementation
      console.warn('GLB download needs trajectory-api.downloadGLBArchive()');
    }catch(error){
      console.error('Download failed:', error);
    }finally{
      setDownloadProgress(null);
      setIsMenuOpen(false);
    }
  };
  const handleDownloadRasterImagesZip = async() => {
    if(!trajectoryId) return;
    const q: string[] = [];
    if(scene?.analysisId) q.push(`analysisId=${encodeURIComponent(scene.analysisId)}`);
    if(scene?.model) q.push(`model=${encodeURIComponent(scene.model)}`);
    q.push('includePreview=0');
    const qs = q.length ? `?${q.join('&')}` : '';
    setDownloadProgress(0);
    try{
      // Note: downloadBlob functionality would need to be added to raster-api
      console.warn('Raster images download needs raster-api.downloadImagesArchive()');
    }catch(error){
      console.error('Download failed:', error);
    }finally{
      setDownloadProgress(null);
      setIsMenuOpen(false);
    }
  };

  if(isLoading && !scene?.data) return <RasterSceneSkeleton />;

  if(!scene?.data){
    return (
      <figure className="d-flex column raster-scene-container p-relative w-max h-max" style={{ flex: 1, minWidth: 0 }}>
        <div className="raster-scene-topbar sm:d-flex sm:column sm:gap-05 p-relative w-max items-center">
          <div className="raster-scene-topbar-center">
            <AnalysisSelect {...analysisSelect} />
          </div>
        </div>
        <div className="d-flex flex-center items-center raster-scene-main flex-1">
          <Skeleton
            variant="rectangular"
            animation="wave"
            width="100%"
            height="var(--raster-scene-height)"
            sx={{ borderRadius: '0.75rem', bgcolor: 'rgba(255,255,255,0.06)' }}
          />
        </div>
        <div className="raster-scene-bottombar items-center">
          <PlaybackControls {...playbackControls} />
        </div>
        <ModelRail {...modelRail} />
      </figure>
    );
  }

  const frameNumber = scene.frame ?? 'unknown';
  const modelName = scene.model ? scene.model[0].toUpperCase() + scene.model.slice(1) : 'Unknown';

  return (
    <figure className="d-flex column raster-scene-container p-relative w-max h-max" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <div className="raster-scene-topbar sm:d-flex sm:column sm:gap-05 p-relative w-max items-center">
        <div className="raster-scene-topbar-center">
          <AnalysisSelect {...analysisSelect} />
        </div>
        <div className="d-flex items-center gap-05 raster-scene-topbar-right p-relative">
          <Button
            variant='ghost'
            intent='neutral'
            iconOnly
            size='sm'
            aria-label="Download"
            title="Download"
            onClick={() => setIsMenuOpen(v => !v)}
            disabled={!canDownload}
            isLoading={typeof downloadProgress === 'number'}
          >
            <LuDownload size={18} />
          </Button>
          {isMenuOpen && (
            <div className="d-flex column raster-scene-download-menu p-absolute">
              <Button variant='ghost' intent='neutral' size='sm' align='start' block onClick={handleDownloadDislocations} disabled={!scene?.analysisId}>
                Dislocations data(JSON)
              </Button>
              <Button variant='ghost' intent='neutral' size='sm' align='start' block onClick={handleDownloadGLBZip} disabled={!canDownload}>
                Frames GLBs(zip)
              </Button>
              <Button variant='ghost' intent='neutral' size='sm' align='start' block onClick={handleDownloadRasterImagesZip} disabled={!canDownload}>
                Raster images(zip)
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="d-flex flex-center items-center raster-scene-main flex-1">
        {/*scene.data && !showModel3D && (
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: 4,
              fontSize: '0.75rem',
              zIndex: 5,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11V13C20 17.4183 16.4183 21 12 21C7.58172 21 4 17.4183 4 13V11"></path><path d="M12 3C12 3 14.121 3 16 3C17.879 3 19.501 3 20 3C21.001 3 21 4 21 4C21 4 21 7.764 21 9.5"></path><path d="M4.5 9.5C4.5 7.764 4.5 4 4.5 4C4.5 4 4.499 3 5.5 3C5.999 3 7.621 3 9.5 3C11.379 3 13.5 3 13.5 3"></path><path d="M12 12V21"></path><path d="M12 12L16 8"></path><path d="M12 12L8 8"></path></svg>
            Double-click to view in 3D
          </div>
        )*/}

        <AnimatePresence mode="wait" initial={false}>
          {showUnavailable ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.5)',
                textAlign: 'center',
                borderRadius: '0.75rem',
              }}
              className='d-flex column gap-05 flex-center'
            >
              <div>Model not found</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{modelName} - Frame {frameNumber}</div>
            </div>
          ) : !disableAnimation ? (
            <motion.img
              className="raster-scene"
              src={scene.data}
              alt={`${scene.model} - Frame ${scene.frame}`}
              initial={false}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{ objectFit: 'contain', width: '100%', cursor: 'pointer' }}
              onDoubleClick={handleDoubleClick}
              title="Double-click to view in 3D"
            />
          ) : (
            <img
              className="raster-scene"
              src={scene.data}
              alt={`${scene.model} - Frame ${scene.frame}`}
              style={{ objectFit: 'contain', width: '100%', cursor: 'pointer' }}
              onDoubleClick={handleDoubleClick}
              title="Double-click to view in 3D"
            />
          )}
        </AnimatePresence>
      </div>

      <div className="raster-scene-bottombar items-center">
        <PlaybackControls {...playbackControls} />
      </div>

      <ModelRail {...modelRail} />
    </figure>
  );
};

export default RasterScene;
