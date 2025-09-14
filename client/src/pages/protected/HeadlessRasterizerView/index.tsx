import { useEffect, useRef, useState, useCallback } from "react"
import { useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { GoArrowUpRight } from "react-icons/go"
import { IoPlayOutline, IoPauseOutline, IoChevronBack, IoChevronForward } from "react-icons/io5"
import Skeleton from "@mui/material/Skeleton"
import useRasterStore from "@/stores/raster"
import Select from "@/components/atoms/form/Select"
import "./HeadlessRasterizerView.css"

interface RasterSceneProps {
    scene: { frame: number; model: string; data: string }
    trajectory: any
    disableAnimation?: boolean
    isPlaying: boolean
    onPlayPause: () => void
    onPrev: () => void
    onNext: () => void
    analysesNames: { _id: string; name: string }[]
    selectedAnalysis: string | null
    setSelectedAnalysis: (id: string | null) => void
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
}) => {
    if (!scene) return null
    return (
        <figure className="raster-scene-container">
            <div className="raster-view-trajectory-name-container raster-floating-container">
                <h3 className="raster-view-trajectory-name">{trajectory?.name}</h3>
            </div>
            <div className="raster-view-trajectory-frame-container raster-floating-container">
                <span className="raster-view-trajectory-frame">Frame {scene.frame}</span>
            </div>
            <div className="raster-analysis-selection-container raster-floating-container">
                <Select
                    onDark
                    value={selectedAnalysis ?? ""}
                    className="raster-analysis-select"
                    onChange={(id) => setSelectedAnalysis(id)}
                    options={analysesNames.map((a) => ({ value: a._id, title: a.name }))}
                    disabled={!analysesNames.length}
                />
            </div>
            <div className="raster-view-trajectory-editor-icon-container raster-floating-container">
                <span className="raster-floating-helper-text">View in Editor</span>
                <GoArrowUpRight />
            </div>
            <div className="raster-view-trajectory-playback-container raster-floating-container">
                <IoChevronBack onClick={onPrev} className="raster-view-trajectory-play-icon" />
                {isPlaying ? (
                    <IoPauseOutline onClick={onPlayPause} className="raster-view-trajectory-play-icon" />
                ) : (
                    <IoPlayOutline onClick={onPlayPause} className="raster-view-trajectory-play-icon" />
                )}
                <IoChevronForward onClick={onNext} className="raster-view-trajectory-play-icon" />
            </div>
            {disableAnimation ? (
                <img key={`${scene.frame}-${scene.model}`} className="raster-scene" src={scene.data} alt={`${scene.model} - Frame ${scene.frame}`} />
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
                    />
                </AnimatePresence>
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
    const { trajectory, analyses, analysesNames, selectedAnalysis, setSelectedAnalysis, getRasterFrames, isLoading } = useRasterStore()
    const [selectedFrameIndex, setSelectedFrameIndex] = useState(0)
    const [selectedModel, setSelectedModel] = useState("preview")
    const [isPlaying, setIsPlaying] = useState(false)
    const thumbnailsRef = useRef<HTMLDivElement>(null)
    const thumbnailItemsRef = useRef<(HTMLDivElement | null)[]>([])
    useEffect(() => {
        if (trajectoryId) getRasterFrames(trajectoryId)
    }, [trajectoryId])
    const analysisData = selectedAnalysis ? analyses[selectedAnalysis] : null
    const frames = analysisData ? Object.values(analysisData.frames) : []
    const sortedFrames = frames.sort((a: any, b: any) => a.frame - b.frame)
    const currentFrame = sortedFrames[selectedFrameIndex]
    const currentScene = currentFrame ? currentFrame[selectedModel] || currentFrame["preview"] : null
    useEffect(() => {
        if (!isPlaying || sortedFrames.length === 0) return
        const interval = setInterval(() => handleNext(), 300)
        return () => clearInterval(interval)
    }, [isPlaying, sortedFrames, selectedFrameIndex])
    useEffect(() => {
        if (thumbnailsRef.current && thumbnailItemsRef.current[selectedFrameIndex]) {
            smoothScrollIntoView(thumbnailsRef.current, thumbnailItemsRef.current[selectedFrameIndex]!)
        }
    }, [selectedFrameIndex])
    const handlePlayPause = () => setIsPlaying((prev) => !prev)
    const handlePrev = () => sortedFrames.length && setSelectedFrameIndex((prev) => (prev - 1 + sortedFrames.length) % sortedFrames.length)
    const handleNext = () => sortedFrames.length && setSelectedFrameIndex((prev) => (prev + 1) % sortedFrames.length)
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === "Enter") setIsPlaying((prev) => !prev)
    }, [])
    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [handleKeyDown])
    return (
        <main className="raster-view-container">
            <div className="raster-scenes-container">
                <div className="raster-scenes-top-container">
                    {isLoading || !currentScene ? (
                        <>
                            <div className="raster-scene-container">
                                <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: "1rem" }} />
                            </div>
                            <div className="raster-analyses-container">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton key={i} variant="rectangular" width={280} height={150} sx={{ borderRadius: "1rem" }} />
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <RasterScene
                                key={`${currentScene.frame}-${currentScene.model}`}
                                scene={currentScene}
                                trajectory={trajectory}
                                disableAnimation={isPlaying}
                                isPlaying={isPlaying}
                                onPlayPause={handlePlayPause}
                                onPrev={handlePrev}
                                onNext={handleNext}
                                analysesNames={analysesNames}
                                selectedAnalysis={selectedAnalysis}
                                setSelectedAnalysis={setSelectedAnalysis}
                            />
                            <div className="raster-analyses-container">
                                {currentFrame &&
                                    Object.values(currentFrame).map((model: any) => (
                                        <motion.img
                                            key={`${model.frame}-${model.model}`}
                                            className={`raster-analysis-scene ${model.model === selectedModel ? "selected" : ""}`}
                                            src={model.data}
                                            alt={`${model.model} - Frame ${model.frame}`}
                                            title={model.model}
                                            whileHover={{ scale: 1.08, boxShadow: "0 15px 30px rgba(0,0,0,0.4)" }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setSelectedModel(model.model)}
                                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                        />
                                    ))}
                            </div>
                        </>
                    )}
                </div>
                <div className="raster-thumbnails" ref={thumbnailsRef}>
                    {isLoading
                        ? Array.from({ length: 10 }).map((_, i) => (
                              <Skeleton key={i} variant="rectangular" width={280} height={200} sx={{ borderRadius: "1rem", flexShrink: 0 }} />
                          ))
                        : sortedFrames.map((frame: any, index: number) => {
                              const modelData = frame[selectedModel] || frame["preview"]
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
                                  >
                                      <div className="raster-thumbnail-timestep-container">
                                          <p className="raster-thumbnail-timestep">{modelData.frame}</p>
                                      </div>
                                      <img className="raster-thumbnail" src={modelData.data} alt={`${modelData.model} - Frame ${modelData.frame}`} onClick={() => setSelectedFrameIndex(index)} />
                                  </motion.div>
                              )
                          })}
                </div>
            </div>
        </main>
    )
}

export default RasterView
