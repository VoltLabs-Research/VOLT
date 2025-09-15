// HeadlessRasterizerView.tsx
import { TbCube3dSphere } from "react-icons/tb";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IoPlayOutline, IoPauseOutline, IoSearchOutline, IoLogInOutline } from "react-icons/io5";
import Skeleton from "@mui/material/Skeleton";
import useRasterStore from "@/stores/raster";
import Select from "@/components/atoms/form/Select";
import "./HeadlessRasterizerView.css";
import { BsArrowLeft } from "react-icons/bs";

interface RasterSceneProps {
  scene: { frame: number; model: string; data: string } | null;
  trajectory: any;
  disableAnimation?: boolean;
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  analysesNames: { _id: string; name: string }[];
  selectedAnalysis: string | null;
  setSelectedAnalysis: (id: string | null) => void;
  modelsForCurrentFrame: any[];
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  isLoading?: boolean;
}

const RasterScene: React.FC<RasterSceneProps> = ({
  scene,
  disableAnimation,
  isPlaying,
  onPlayPause,
  analysesNames,
  selectedAnalysis,
  setSelectedAnalysis,
  modelsForCurrentFrame,
  selectedModel,
  setSelectedModel,
  isLoading = false,
}) => {
  const pickerDockWidth = 132;

  // ========= SKELETON ABSOLUTO (separado del loader del canvas) =========
  if (isLoading) {
    return (
      <figure className="raster-scene-container" style={{ flex: 1, minWidth: 0 }}>
        {/* Loader del canvas (rectangular, ocupa la zona de imagen) */}
        <div className="raster-scene-main">
          <Skeleton
            variant="rectangular"
            animation="wave"
            width="100%"
            height="100%"
            sx={{ borderRadius: "0.75rem", bgcolor: "rgba(255,255,255,0.06)" }}
          />
        </div>

        {/* Overlays absolutos */}
        <div className="raster-skel raster-skel-select">
          <Skeleton variant="rounded" animation="wave" height={40} sx={{ borderRadius: "0.75rem", bgcolor: "rgba(255,255,255,0.10)" }} />
        </div>

        <div className="raster-skel raster-skel-frame">
          <Skeleton variant="rounded" animation="wave" width={140} height={36} sx={{ borderRadius: "9999px", bgcolor: "rgba(255,255,255,0.10)" }} />
        </div>

        <div className="raster-skel raster-skel-playback">
          <Skeleton variant="rounded" animation="wave" width={180} height={42} sx={{ borderRadius: "9999px", bgcolor: "rgba(255,255,255,0.12)" }} />
        </div>

        <div className="raster-skel raster-skel-rail" style={{ width: `${pickerDockWidth}px` }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={`rail-skel-${i}`}
              variant="rounded"
              animation="wave"
              height={84}
              width="100%"
              sx={{ borderRadius: "0.75rem", bgcolor: "rgba(255,255,255,0.08)" }}
            />
          ))}
        </div>
      </figure>
    );
  }

  // ========= Estado con datos =========
  useEffect(() => {
    if (!modelsForCurrentFrame?.length) return;
    if (!modelsForCurrentFrame.some((m: any) => m.model === selectedModel)) {
      setSelectedModel(modelsForCurrentFrame[0].model);
    }
  }, [modelsForCurrentFrame, selectedModel, setSelectedModel]);

  const [railOpen, setRailOpen] = useState(false);
  const selectedThumb = useMemo(
    () =>
      (modelsForCurrentFrame || []).find((m: any) => m.model === selectedModel) ||
      (modelsForCurrentFrame || [])[0],
    [modelsForCurrentFrame, selectedModel]
  );
  const restThumbs = useMemo(
    () => (modelsForCurrentFrame || []).filter((m: any) => m.model !== selectedThumb?.model),
    [modelsForCurrentFrame, selectedThumb]
  );

  if (!scene) {
    // Seguridad por si llega null fuera del loading
    return (
      <figure className="raster-scene-container" style={{ flex: 1, minWidth: 0 }}>
        <div className="raster-scene-main">
          <Skeleton
            variant="rectangular"
            animation="wave"
            width="100%"
            height="100%"
            sx={{ borderRadius: "0.75rem", bgcolor: "rgba(255,255,255,0.06)" }}
          />
        </div>
      </figure>
    );
  }

  return (
    <figure className="raster-scene-container" style={{ flex: 1, minWidth: 0, position: "relative" }}>
      {/* TOPBAR: solo selector centrado */}
      <div className="raster-scene-topbar">
        <div className="raster-scene-topbar-center">
          <div className="raster-analysis-selection-container">
            <Select
              onDark
              value={selectedAnalysis ?? ""}
              className="raster-analysis-select"
              onChange={(id) => setSelectedAnalysis(id)}
              options={analysesNames.map((a) => ({ value: a._id, title: a.name }))}
              disabled={!analysesNames.length}
            />
          </div>
        </div>
      </div>

      {/* CANVAS */}
      <div className="raster-scene-main">
        {disableAnimation ? (
          <img
            key={`${scene.frame}-${scene.model}`}
            className="raster-scene"
            src={scene.data}
            alt={`${scene.model} - Frame ${scene.frame}`}
            style={{ objectFit: "contain", width: "100%" }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.img
              key={`${scene.frame}-${scene.model}`}
              className="raster-scene"
              src={scene.data}
              alt={`${scene.model} - Frame ${scene.frame}`}
              initial={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              style={{ objectFit: "contain", width: "100%" }}
            />
          </AnimatePresence>
        )}
      </div>

      {/* BOTTOMBAR */}
      <div className="raster-scene-bottombar">
        <div className="raster-view-trajectory-playback-container">
          {isPlaying ? (
            <IoPauseOutline onClick={onPlayPause} className="raster-view-trajectory-play-icon" />
          ) : (
            <IoPlayOutline onClick={onPlayPause} className="raster-view-trajectory-play-icon" />
          )}
        </div>
      </div>

      {/* RAIL (hover para expandir) */}
      {selectedThumb && (
        <motion.div
          className="raster-rail-container"
          style={{ width: `${pickerDockWidth}px` }}
          onMouseEnter={() => setRailOpen(true)}
          onMouseLeave={() => setRailOpen(false)}
          initial={false}
          transition={{ duration: 0.2 }}
        >
          <motion.img
            key={`sel-${selectedThumb.frame}-${selectedThumb.model}`}
            className={`raster-analysis-scene selected`}
            src={selectedThumb.data}
            alt={`${selectedThumb.model} - Frame ${selectedThumb.frame}`}
            title={selectedThumb.model}
            onClick={() => setSelectedModel(selectedThumb.model)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            style={{
              width: "100%",
              height: 84,
              objectFit: "cover",
              borderRadius: "0.75rem",
              border: "1px solid var(--accent)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />

          <AnimatePresence>
            {railOpen &&
              restThumbs.map((m: any) => (
                <motion.img
                  key={`opt-${m.frame}-${m.model}`}
                  className="raster-analysis-scene"
                  src={m.data}
                  alt={`${m.model} - Frame ${m.frame}`}
                  title={m.model}
                  onClick={() => setSelectedModel(m.model)}
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: 84, scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    width: "100%",
                    objectFit: "cover",
                    borderRadius: "0.75rem",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                />
              ))}
          </AnimatePresence>
        </motion.div>
      )}
    </figure>
  );
};

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

const smoothScrollIntoView = (container: HTMLElement, target: HTMLElement) => {
  const start = container.scrollLeft;
  const end = target.offsetLeft - container.clientWidth / 2 + target.clientWidth / 2;
  const distance = end - start;
  const duration = 800;
  let startTime: number | null = null;
  const step = (timestamp: number) => {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuart(progress);
    container.scrollLeft = start + distance * eased;
    if (elapsed < duration) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const RasterView: React.FC = () => {
  const navigate = useNavigate();
  const { trajectoryId } = useParams<{ trajectoryId: string }>();
  const { trajectory, analyses, analysesNames, getRasterFrames, isLoading } = useRasterStore();

  const [selectedAnalysisLeft, setSelectedAnalysisLeft] = useState<string | null>(null);
  const [selectedAnalysisRight, setSelectedAnalysisRight] = useState<string | null>(null);

  const [selectedModelLeft, setSelectedModelLeft] = useState("preview");
  const [selectedModelRight, setSelectedModelRight] = useState("preview");

  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const thumbnailItemsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (trajectoryId) getRasterFrames(trajectoryId);
  }, [trajectoryId, getRasterFrames]);

  useEffect(() => {
    if (!analysesNames?.length) return;
    if (analysesNames.length >= 2) {
      setSelectedAnalysisLeft(analysesNames[0]._id);
      setSelectedAnalysisRight(analysesNames[1]._id);
    } else {
      setSelectedAnalysisLeft(analysesNames[0]._id);
      setSelectedAnalysisRight(analysesNames[0]._id);
      setSelectedModelRight("atoms_colored_by_type");
    }
  }, [analysesNames]);

  const getSortedFrames = (analysisId: string | null) => {
    if (!analysisId) return [];
    const a = analyses?.[analysisId];
    if (!a?.frames) return [];
    const frames = Object.values(a.frames);
    // @ts-ignore
    return frames.sort((x: any, y: any) => x.frame - y.frame);
  };

  const sortedFramesLeft = useMemo(() => getSortedFrames(selectedAnalysisLeft), [selectedAnalysisLeft, analyses]);
  const sortedFramesRight = useMemo(() => getSortedFrames(selectedAnalysisRight), [selectedAnalysisRight, analyses]);

  const currentFrameLeft = sortedFramesLeft.length ? sortedFramesLeft[selectedFrameIndex % sortedFramesLeft.length] : null;
  const currentFrameRight = sortedFramesRight.length ? sortedFramesRight[selectedFrameIndex % sortedFramesRight.length] : null;

  const currentSceneLeft = currentFrameLeft ? (currentFrameLeft as any)[selectedModelLeft] || (currentFrameLeft as any)["preview"] : null;
  let currentSceneRight = currentFrameRight ? (currentFrameRight as any)[selectedModelRight] : null;
  if (!currentSceneRight && currentFrameRight) currentSceneRight = (currentFrameRight as any)["preview"];

  const refFrames = sortedFramesLeft.length ? sortedFramesLeft : sortedFramesRight;

  useEffect(() => {
    if (!isPlaying || refFrames.length === 0) return;
    const id = setInterval(() => handleNext(), 300);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, refFrames, selectedFrameIndex]);

  useEffect(() => {
    if (thumbnailsRef.current && thumbnailItemsRef.current[selectedFrameIndex]) {
      smoothScrollIntoView(thumbnailsRef.current, thumbnailItemsRef.current[selectedFrameIndex]!);
    }
  }, [selectedFrameIndex]);

  const handlePlayPause = () => setIsPlaying((prev) => !prev);
  const handlePrev = () => {
    const len = refFrames.length;
    if (!len) return;
    setSelectedFrameIndex((prev) => (prev - 1 + len) % len);
  };
  const handleNext = () => {
    const len = refFrames.length;
    if (!len) return;
    setSelectedFrameIndex((prev) => (prev + 1) % len);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === "Enter") setIsPlaying((prev) => !prev);
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const thumbnailsFrames = refFrames;
  const thumbnailsModel = refFrames === sortedFramesLeft ? selectedModelLeft : selectedModelRight;

  const handleSignIn = () => console.log("Sign in clicked");
  const handleView3D = () => console.log("View in 3D clicked");

  return (
    <main className="raster-view-container">
      {/* HEADER con skeleton del bloque solicitado */}
      <div className="raster-scene-header-container">
        <div className="raster-scene-header-left-container">
          <i 
            className="raster-scene-header-go-back-icon-container"
            onClick={() => navigate('/dashboard')}
          >
            <BsArrowLeft />
          </i>

          <div className="raster-scene-header-team-container">
            {isLoading ? (
              <>
                {/* Title skeleton */}
                <Skeleton
                  variant="rounded"
                  animation="wave"
                  width={220}
                  height={22}
                  sx={{ borderRadius: "6px", bgcolor: "rgba(255,255,255,0.12)" }}
                />
                {/* Subtitle skeleton */}
                <Skeleton
                  variant="rounded"
                  animation="wave"
                  width={180}
                  height={14}
                  sx={{ borderRadius: "6px", mt: 0.75, bgcolor: "rgba(255,255,255,0.08)" }}
                />
              </>
            ) : (
              <>
                <h3 className="raster-scene-header-title">{trajectory?.name}</h3>
                <p className="raster-scene-header-last-edited">Last Edited by Rodolfo H</p>
              </>
            )}
          </div>
        </div>

        <div className="raster-scene-header-search-container">
          <div className="dashboard-search-container">
            <div className="search-container">
              <i className="search-icon-container">
                <IoSearchOutline />
              </i>
              <input placeholder="Search uploaded team trajectories" className="search-input " />
            </div>
          </div>
        </div>

        <div className="raster-scene-header-nav-container">
          <motion.button
            className="btn-3d"
            aria-label="View in 3D"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleView3D}
          >
            <span className="btn-3d-glow" />
            <TbCube3dSphere size={18} />
            <span>View in 3D</span>
          </motion.button>

          <motion.button
            className="btn-signin"
            aria-label="Sign in"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSignIn}
          >
            <span className="btn-signin-glow" />
            <IoLogInOutline size={18} />
            <span>Sign in</span>
          </motion.button>
        </div>
      </div>

      {/* ESCENAS */}
      <div className="raster-scenes-container" style={{ position: "relative" }}>
        <div className="raster-scenes-top-container" style={{ alignItems: "stretch", gap: ".75rem" }}>
          <motion.div style={{ flex: 1, minWidth: 0 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <RasterScene
              scene={currentSceneLeft}
              trajectory={trajectory}
              disableAnimation={isPlaying}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onPrev={handlePrev}
              onNext={handleNext}
              analysesNames={analysesNames}
              selectedAnalysis={selectedAnalysisLeft}
              setSelectedAnalysis={setSelectedAnalysisLeft}
              modelsForCurrentFrame={currentFrameLeft ? Object.values(currentFrameLeft as any) : []}
              selectedModel={selectedModelLeft}
              setSelectedModel={setSelectedModelLeft}
              isLoading={isLoading}
            />
          </motion.div>

          <motion.div style={{ flex: 1, minWidth: 0 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <RasterScene
              scene={currentSceneRight}
              trajectory={trajectory}
              disableAnimation={isPlaying}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onPrev={handlePrev}
              onNext={handleNext}
              analysesNames={analysesNames}
              selectedAnalysis={selectedAnalysisRight}
              setSelectedAnalysis={setSelectedAnalysisRight}
              modelsForCurrentFrame={currentFrameRight ? Object.values(currentFrameRight as any) : []}
              selectedModel={selectedModelRight}
              setSelectedModel={setSelectedModelRight}
              isLoading={isLoading}
            />
          </motion.div>
        </div>

        {/* THUMBNAILS */}
        <div className="raster-thumbnails" ref={thumbnailsRef} style={{ paddingBlock: ".25rem" }}>
          {isLoading || !thumbnailsFrames.length
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={`thumb-skel-${i}`} className="raster-thumbnail-container" style={{ position: "relative" }}>
                  <Skeleton
                    variant="rectangular"
                    animation="wave"
                    width={280}
                    height={160}
                    sx={{ borderRadius: "0.75rem", bgcolor: "rgba(255,255,255,0.06)" }}
                  />
                  <Skeleton
                    variant="rounded"
                    animation="wave"
                    width={58}
                    height={26}
                    sx={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      borderRadius: "9999px",
                      bgcolor: "rgba(255,255,255,0.10)",
                    }}
                  />
                </div>
              ))
            : thumbnailsFrames.map((frame: any, index: number) => {
                const modelData = frame[thumbnailsModel] || frame["preview"];
                if (!modelData) return null;
                const isActive = index === selectedFrameIndex;
                return (
                  <motion.div
                    key={`${modelData.frame}-${modelData.model}-container`}
                    className={`raster-thumbnail-container ${isActive ? "active" : ""}`}
                    ref={(el) => (thumbnailItemsRef.current[index] = el)}
                    animate={
                      isPlaying
                        ? { scale: isActive ? 1 : 0.98, opacity: isActive ? 1 : 0.5, rotateY: isActive ? 0 : (index < selectedFrameIndex ? -20 : 20) }
                        : { scale: 1, opacity: 1, rotateY: 0 }
                    }
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => setSelectedFrameIndex(index)}
                    style={{ flexShrink: 0 }}
                  >
                    <div className="raster-thumbnail-timestep-container">
                      <p className="raster-thumbnail-timestep">{modelData.frame}</p>
                    </div>
                    <img className="raster-thumbnail" src={modelData.data} alt={`${modelData.model} - Frame ${modelData.frame}`} />
                  </motion.div>
                );
              })}
        </div>
      </div>
    </main>
  );
};

export default RasterView;
