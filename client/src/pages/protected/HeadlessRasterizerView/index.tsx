import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { GoArrowUpRight } from "react-icons/go"
import { IoPlayOutline, IoPauseOutline, IoChevronBack, IoChevronForward } from "react-icons/io5"
import Skeleton from "@mui/material/Skeleton"
import useRasterStore from "@/stores/raster"
import Select from "@/components/atoms/form/Select"
import "./HeadlessRasterizerView.css"

interface RasterSceneProps {
  scene: { frame: number; model: string; data: string } | null
  trajectory: any
  disableAnimation?: boolean
  isPlaying: boolean
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  analysesNames: { _id: string; name: string }[]
  selectedAnalysis: string | null
  setSelectedAnalysis: (id: string | null) => void
  modelsForCurrentFrame: any[]
  selectedModel: string
  setSelectedModel: (m: string) => void
  showInlineModelPicker?: boolean
}

const RasterScene: React.FC<RasterSceneProps> = ({
  scene,
  trajectory,
  disableAnimation,
  isPlaying,
  onPlayPause,
  onPrev,
  onNext,
  analysesNames,
  selectedAnalysis,
  setSelectedAnalysis,
  modelsForCurrentFrame,
  selectedModel,
  setSelectedModel,
  showInlineModelPicker = false,
}) => {
  const pickerDockWidth = 132 // ancho del rail en split

  // Asegura que siempre haya un seleccionado válido
  useEffect(() => {
    if (!modelsForCurrentFrame?.length) return
    if (!modelsForCurrentFrame.some((m: any) => m.model === selectedModel)) {
      setSelectedModel(modelsForCurrentFrame[0].model)
    }
  }, [modelsForCurrentFrame, selectedModel, setSelectedModel])

  // Rail: cerrado = solo seleccionado; abierto (hover) = todos
  const [railOpen, setRailOpen] = useState(false)
  const selectedThumb = useMemo(
    () =>
      (modelsForCurrentFrame || []).find((m: any) => m.model === selectedModel) ||
      (modelsForCurrentFrame || [])[0],
    [modelsForCurrentFrame, selectedModel]
  )
  const restThumbs = useMemo(
    () => (modelsForCurrentFrame || []).filter((m: any) => m.model !== selectedThumb?.model),
    [modelsForCurrentFrame, selectedThumb]
  )

  if (!scene) {
    return (
      <figure className="raster-scene-container" style={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: "1rem" }} />
      </figure>
    )
  }

  return (
    <figure className="raster-scene-container" style={{ flex: 1, minWidth: 0, position: "relative" }}>
      {/* TOPBAR (sin absolute) */}
      <div className="raster-scene-topbar">
        <div className="raster-scene-topbar-left">
          <div className="raster-view-trajectory-name-container raster-chip">
            <h3 className="raster-view-trajectory-name" title={trajectory?.name}>{trajectory?.name}</h3>
          </div>
        </div>

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

        <button className="raster-view-trajectory-editor-icon-container btn-chip" title="Ver en Editor">
          <span className="raster-floating-helper-text">View in Editor</span>
          <GoArrowUpRight />
        </button>
      </div>

      {/* CANVAS (reserva espacio lateral si hay rail) */}
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

      {/* BOTTOMBAR (frame + playback) */}
      <div className="raster-scene-bottombar">
        <div className="raster-view-trajectory-frame-container raster-chip">
          <span className="raster-view-trajectory-frame">Frame {scene.frame}</span>
        </div>

        <div className="raster-view-trajectory-playback-container">
          <IoChevronBack onClick={onPrev} className="raster-view-trajectory-play-icon" />
          {isPlaying ? (
            <IoPauseOutline onClick={onPlayPause} className="raster-view-trajectory-play-icon" />
          ) : (
            <IoPlayOutline onClick={onPlayPause} className="raster-view-trajectory-play-icon" />
          )}
          <IoChevronForward onClick={onNext} className="raster-view-trajectory-play-icon" />
        </div>
      </div>

      {/* RAIL de modelos: solo seleccionado; en hover muestra todos */}
      {showInlineModelPicker && selectedThumb && (
        <motion.div
          className="raster-rail-container"
          style={{ width: `${pickerDockWidth}px` }}
          onMouseEnter={() => setRailOpen(true)}
          onMouseLeave={() => setRailOpen(false)}
          initial={false}
          transition={{ duration: 0.2 }}
        >
          {/* Siempre visible: seleccionado */}
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
              border: "1px solid #6366F1",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />

          {/* En hover: el resto */}
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
  )
}

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)

const smoothScrollIntoView = (container: HTMLElement, target: HTMLElement) => {
  const start = container.scrollLeft
  const end = target.offsetLeft - container.clientWidth / 2 + target.clientWidth / 2
  const distance = end - start
  const duration = 800
  let startTime: number | null = null
  const step = (timestamp: number) => {
    if (!startTime) startTime = timestamp
    const elapsed = timestamp - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeOutQuart(progress)
    container.scrollLeft = start + distance * eased
    if (elapsed < duration) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const RasterView: React.FC = () => {
  const { trajectoryId } = useParams<{ trajectoryId: string }>()
  const { trajectory, analyses, analysesNames, getRasterFrames, isLoading } = useRasterStore()

  const [splitMode, setSplitMode] = useState(false)

  const [selectedAnalysisLeft, setSelectedAnalysisLeft] = useState<string | null>(null)
  const [selectedAnalysisRight, setSelectedAnalysisRight] = useState<string | null>(null)

  const [selectedModelLeft, setSelectedModelLeft] = useState("preview")
  const [selectedModelRight, setSelectedModelRight] = useState("preview")

  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const thumbnailsRef = useRef<HTMLDivElement>(null)
  const thumbnailItemsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (trajectoryId) getRasterFrames(trajectoryId)
  }, [trajectoryId, getRasterFrames])

  useEffect(() => {
    if (!analysesNames?.length) return
    if (!selectedAnalysisLeft) setSelectedAnalysisLeft(analysesNames[0]._id)
    if (!selectedAnalysisRight) setSelectedAnalysisRight(analysesNames[1]?._id ?? analysesNames[0]._id)
  }, [analysesNames, selectedAnalysisLeft, selectedAnalysisRight])

  const getSortedFrames = (analysisId: string | null) => {
    if (!analysisId) return []
    const a = analyses?.[analysisId]
    if (!a?.frames) return []
    const frames = Object.values(a.frames)
    // @ts-ignore
    return frames.sort((x: any, y: any) => x.frame - y.frame)
  }

  const sortedFramesLeft = useMemo(() => getSortedFrames(selectedAnalysisLeft), [selectedAnalysisLeft, analyses])
  const sortedFramesRight = useMemo(() => getSortedFrames(selectedAnalysisRight), [selectedAnalysisRight, analyses])

  const currentFrameLeft = sortedFramesLeft.length ? sortedFramesLeft[selectedFrameIndex % sortedFramesLeft.length] : null
  const currentFrameRight = sortedFramesRight.length ? sortedFramesRight[selectedFrameIndex % sortedFramesRight.length] : null

  const currentSceneLeft = currentFrameLeft ? (currentFrameLeft as any)[selectedModelLeft] || (currentFrameLeft as any)["preview"] : null
  const currentSceneRight = currentFrameRight ? (currentFrameRight as any)[selectedModelRight] || (currentFrameRight as any)["preview"] : null

  const refFrames = sortedFramesLeft.length ? sortedFramesLeft : sortedFramesRight

  useEffect(() => {
    if (!isPlaying || refFrames.length === 0) return
    const interval = setInterval(() => handleNext(), 300)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, refFrames, selectedFrameIndex])

  useEffect(() => {
    if (thumbnailsRef.current && thumbnailItemsRef.current[selectedFrameIndex]) {
      smoothScrollIntoView(thumbnailsRef.current, thumbnailItemsRef.current[selectedFrameIndex]!)
    }
  }, [selectedFrameIndex])

  const handlePlayPause = () => setIsPlaying((prev) => !prev)
  const handlePrev = () => {
    const len = refFrames.length
    if (!len) return
    setSelectedFrameIndex((prev) => (prev - 1 + len) % len)
  }
  const handleNext = () => {
    const len = refFrames.length
    if (!len) return
    setSelectedFrameIndex((prev) => (prev + 1) % len)
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === "Enter") setIsPlaying((prev) => !prev)
  }, [])
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const thumbnailsFrames = refFrames
  const thumbnailsModel = refFrames === sortedFramesLeft ? selectedModelLeft : selectedModelRight

  return (
    <main className="raster-view-container">
      <div className="raster-scenes-container" style={{ position: "relative" }}>
        {/* Toggle Split / Single */}
        <motion.button
          onClick={() => setSplitMode((v) => !v)}
          aria-pressed={splitMode}
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          style={{
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            zIndex: 10,
            background: "#161616",
            color: "#dadada",
            border: "1px solid #323232",
            borderRadius: "9999px",
            padding: ".6rem 1rem",
            fontWeight: 600,
            fontSize: ".9rem",
            boxShadow: splitMode ? "0 12px 32px rgba(99,102,241,0.45)" : "0 8px 20px rgba(0,0,0,0.35)",
          }}
          title={splitMode ? "Volver a vista simple" : "Activar vista dividida"}
        >
          {splitMode ? "Split: ON" : "Split: OFF"}
        </motion.button>

        <div
          className="raster-scenes-top-container"
          style={{
            alignItems: "stretch",
            gap: splitMode ? ".75rem" : "1rem",
          }}
        >
          {isLoading ? (
            <>
              {/* Izquierda */}
              <div className="raster-scene-container" style={{ flex: 1, minWidth: 0 }}>
                <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: "1rem" }} />
              </div>
              {/* Derecha o panel modelos */}
              {splitMode ? (
                <div className="raster-scene-container" style={{ flex: 1, minWidth: 0 }}>
                  <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: "1rem" }} />
                </div>
              ) : (
                <div className="raster-analyses-container">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} variant="rectangular" width={280} height={150} sx={{ borderRadius: "1rem" }} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Vista izquierda */}
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
                  showInlineModelPicker={splitMode}
                />
              </motion.div>

              {/* Vista derecha en Split */}
              {splitMode ? (
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
                    showInlineModelPicker={splitMode}
                  />
                </motion.div>
              ) : (
                // En Single mantenemos el panel de modelos a la derecha (como antes)
                <div className="raster-analyses-container">
                  {currentFrameLeft &&
                    Object.values(currentFrameLeft as any).map((model: any) => (
                      <motion.img
                        key={`${model.frame}-${model.model}`}
                        className={`raster-analysis-scene ${model.model === selectedModelLeft ? "selected" : ""}`}
                        src={model.data}
                        alt={`${model.model} - Frame ${model.frame}`}
                        title={model.model}
                        whileHover={{ scale: 1.08, boxShadow: "0 15px 30px rgba(0,0,0,0.4)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedModelLeft(model.model)}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Thumbnails (comparten índice y controlan ambas) */}
        <div className="raster-thumbnails" ref={thumbnailsRef} style={{ paddingBlock: ".25rem" }}>
          {isLoading || !thumbnailsFrames.length
            ? Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" width={280} height={200} sx={{ borderRadius: "1rem", flexShrink: 0 }} />
              ))
            : thumbnailsFrames.map((frame: any, index: number) => {
                const modelData = frame[thumbnailsModel] || frame["preview"]
                if (!modelData) return null
                const isActive = index === selectedFrameIndex
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
                    <img
                      className="raster-thumbnail"
                      src={modelData.data}
                      alt={`${modelData.model} - Frame ${modelData.frame}`}
                    />
                  </motion.div>
                )
              })}
        </div>
      </div>
    </main>
  )
}

export default RasterView
