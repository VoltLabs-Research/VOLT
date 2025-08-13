import React, { useRef } from 'react'
import Scene3D, { type Scene3DRef } from '@/components/organisms/Scene3D'
import AutoPreviewSaver from '@/components/atoms/scene/AutoPreviewSaver'
import TimestepViewer from '@/components/organisms/TimestepViewer'
import useCanvasCoordinator from '@/hooks/canvas/use-canvas-coordinator'
import LoadingOverlay from '@/components/atoms/LoadingOverlay'
import CanvasWidgets from '@/components/atoms/CanvasWidgets'
import { useParams } from 'react-router-dom'
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
    const { trajectory, currentTimestep } = useCanvasCoordinator()
    
    return (
        <div className='editor-container'>
            <CanvasWidgets
                trajectory={trajectory}
                currentTimestep={currentTimestep}
            />
            {(!trajectory || currentTimestep === undefined) && <LoadingOverlay />}
            <Scene3D ref={scene3DRef}>
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
