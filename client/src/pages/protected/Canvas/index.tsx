import React, { useRef } from 'react'
import Scene3D, { type Scene3DRef } from '@/components/organisms/Scene3D'
import { Canvas } from '@react-three/fiber'
import AutoPreviewSaver from '@/components/atoms/scene/AutoPreviewSaver'
import TimestepViewer from '@/components/organisms/TimestepViewer'
import useCanvasCoordinator from '@/hooks/canvas/use-canvas-coordinator'
import CanvasWidgets from '@/components/atoms/CanvasWidgets'
import TetrahedronLoader from '@/components/atoms/TetrahedronLoader'
import useConfigurationStore from '@/stores/editor/configuration'
import useEditorUIStore from '@/stores/ui/editor'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from "framer-motion";
import './Canvas.css'

const CANVAS_CONFIG = {
    autoSaveDelay: 2000,
    timestepViewerDefaults: {
        scale: 1,
        rotation: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 }
    }
} as const

const EditorPage: React.FC = () => {
    const { trajectoryId } = useParams<{ trajectoryId: string }>()
    const scene3DRef = useRef<Scene3DRef>(null)
    const { trajectory, currentTimestep } = useCanvasCoordinator({ trajectoryId });
    const isModelLoading = useConfigurationStore((state) => state.isModelLoading);
    const showCanvasGrid = useEditorUIStore((state) => state.showCanvasGrid);
    
    return (
        <div className='editor-container'>
            <AnimatePresence>
                {(isModelLoading || (!trajectory || currentTimestep === undefined)) && (
                    <motion.div
                        className="editor-model-loading-wrapper"
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                    >
                        <div className="editor-model-loading-container">
                            <Canvas>
                                <TetrahedronLoader />
                            </Canvas>
                            <div className="editor-model-loading-body-container">
                                <h3 className="editor-model-loading-title">Setting up your scene...</h3>
                                <p className="editor-model-loading-description">
                                    For quick analysis and visualizations you may prefer to rasterize your simulation.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <CanvasWidgets
                trajectory={trajectory}
                currentTimestep={currentTimestep}
            />
            <Scene3D 
                ref={scene3DRef}
                showCanvasGrid={showCanvasGrid}
            >
                <AutoPreviewSaver
                    scene3DRef={scene3DRef}
                    delay={CANVAS_CONFIG.autoSaveDelay}
                    trajectoryId={trajectoryId}
                />

                <TimestepViewer
                    scale={CANVAS_CONFIG.timestepViewerDefaults.scale}
                    rotation={CANVAS_CONFIG.timestepViewerDefaults.rotation}
                    position={CANVAS_CONFIG.timestepViewerDefaults.position}
                />
            </Scene3D>
        </div>
    )
}

export default EditorPage
