import React, {
	useEffect,
	useMemo,
	useState,
	useRef,
	useCallback,
	forwardRef,
	useImperativeHandle
} from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, AdaptiveDpr, AdaptiveEvents, Bvh, Preload } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import ScreenshotHandler from '@/components/atoms/scene/ScreenshotHandler';
import TrajectoryLighting from '@/components/atoms/scene/TrajectoryLighting';
import DefectLighting from '@/components/atoms/scene/DefectLighting';
import CanvasGrid from '@/components/atoms/scene/CanvasGrid';
import DynamicEffects from '@/components/molecules/scene/DynamicEffects';
import DynamicEnvironment from '@/components/molecules/scene/DynamicEnvironment';
import DynamicLights from '@/components/molecules/scene/DynamicLights';
import DynamicBackground from '@/components/molecules/scene/DynamicBackground';
import DynamicRenderer from '@/components/molecules/scene/DynamicRenderer';
import CameraRig from '@/components/atoms/scene/CameraRig';
import useEditorUIStore from '@/stores/ui/editor';
import useModelStore from '@/stores/editor/model';
import usePerformanceSettingsStore from '@/stores/editor/perfomance-settings';
import useCameraSettings from '@/stores/editor/camera-config';
import { useRendererSettings } from '@/stores/editor/renderer-settings';
import useOrbitControlsSettings from '@/stores/editor/orbit-controls';
import { calculateClosestCameraPositionZY } from '@/utilities/glb/modelUtils';
import './Scene3D.css';

interface Scene3DProps {
	children?: React.ReactNode;
	cameraControlsEnabled?: boolean;
	background?: string;
	cssBackground?: string;
	showGizmo?: boolean;
	orbitControlsConfig?: any;
	showCanvasGrid?: boolean;
	onCameraControlsRef?: (ref: any) => void;
}

export interface Scene3DRef {
	captureScreenshot: (options?: {
		width?: number;
		height?: number;
		format?: 'png' | 'jpeg' | 'webp';
		quality?: number;
		fileName?: string;
		download?: boolean;
		zoomFactor?: number;
	} | null) => Promise<string>;
	waitForVisibleFrame: () => Promise<void>;
	markContentReady: () => void;
	waitForContentFrame: () => Promise<void>;
	zoomTo: (zoomFactor: number) => void;
	getCurrentZoom: () => number;
}

const Scene3D = forwardRef<Scene3DRef, Scene3DProps>(({
	children,
	showGizmo = true,
	background = null,
	cssBackground,
	cameraControlsEnabled = true,
	showCanvasGrid = true,
	orbitControlsConfig = {},
	onCameraControlsRef
}, ref) => {
	const orbitControlsRef = useRef<any>(null);
	const interactionTimeoutRef = useRef<number | null>(null);
	const initialDistanceRef = useRef<number | null>(null);

	const [tools, setTools] = useState<{
		captureScreenshot: (options?: any) => Promise<string>;
		waitForVisibleFrame: () => Promise<void>;
		markContentReady: () => void;
		waitForContentFrame: () => Promise<void>;
	} | null>(null);

	const activeScene = useModelStore((s) => s.activeScene);
	const activeModel = useModelStore((s) => s.activeModel);

	const toggleCanvasGrid = useEditorUIStore((s) => s.toggleCanvasGrid);
	const toggleEditorWidgets = useEditorUIStore((s) => s.toggleEditorWidgets);
	const showEditorWidgets = useEditorUIStore((s) => s.showEditorWidgets);
	const setSceneInteracting = useEditorUIStore((s) => s.setSceneInteracting);
	const isInteracting = useEditorUIStore((s) => s.sceneInteracting);

	useCameraSettings((s) => s.type);
	useCameraSettings((s) => s.position);
	useCameraSettings((s) => s.up);

	const dprCfg = usePerformanceSettingsStore((s) => s.dpr);
	const perf = usePerformanceSettingsStore((s) => s.performance);
	const interactionDegradeEnabled = usePerformanceSettingsStore((s) => s.interactionDegrade.enabled);
	const powerPreference = usePerformanceSettingsStore((s) => s.canvas.powerPreference);
	const adaptiveEventsEnabled = usePerformanceSettingsStore((s) => s.adaptiveEvents.enabled);

	const rCreate = useRendererSettings((s) => s.create);

	const ocEnabled = useOrbitControlsSettings((s) => s.enabled);
	const ocEnableDamping = useOrbitControlsSettings((s) => s.enableDamping);
	const ocDampingFactor = useOrbitControlsSettings((s) => s.dampingFactor);
	const ocEnableZoom = useOrbitControlsSettings((s) => s.enableZoom);
	const ocZoomSpeed = useOrbitControlsSettings((s) => s.zoomSpeed);
	const ocEnableRotate = useOrbitControlsSettings((s) => s.enableRotate);
	const ocRotateSpeed = useOrbitControlsSettings((s) => s.rotateSpeed);
	const ocEnablePan = useOrbitControlsSettings((s) => s.enablePan);
	const ocPanSpeed = useOrbitControlsSettings((s) => s.panSpeed);
	const ocScreenSpacePanning = useOrbitControlsSettings((s) => s.screenSpacePanning);
	const ocAutoRotate = useOrbitControlsSettings((s) => s.autoRotate);
	const ocAutoRotateSpeed = useOrbitControlsSettings((s) => s.autoRotateSpeed);
	const ocMinDistance = useOrbitControlsSettings((s) => s.minDistance);
	const ocMaxDistance = useOrbitControlsSettings((s) => s.maxDistance);
	const ocMinPolar = useOrbitControlsSettings((s) => s.minPolarAngle);
	const ocMaxPolar = useOrbitControlsSettings((s) => s.maxPolarAngle);
	const ocMinAzimuth = useOrbitControlsSettings((s) => s.minAzimuthAngle);
	const ocMaxAzimuth = useOrbitControlsSettings((s) => s.maxAzimuthAngle);
	const ocTarget = useOrbitControlsSettings((s) => s.target);

	const dpr = useMemo(() => {
		if(dprCfg.mode === 'fixed') return dprCfg.fixed;
		const min = (isInteracting && interactionDegradeEnabled) ? Math.min(dprCfg.interactionMin, dprCfg.min) : dprCfg.min;
		return [min, dprCfg.max] as [number, number];
	}, [dprCfg.mode, dprCfg.fixed, dprCfg.min, dprCfg.max, dprCfg.interactionMin, interactionDegradeEnabled, isInteracting]);

	const adaptiveEnabled = dprCfg.mode === 'adaptive';
	const pixelated = dprCfg.pixelated;

	const markInteractingNow = useCallback(() => { setSceneInteracting(true); }, [setSceneInteracting]);

	const markInteractingDebounced = useCallback(() => {
		setSceneInteracting(true);
		if(interactionTimeoutRef.current) window.clearTimeout(interactionTimeoutRef.current);
		interactionTimeoutRef.current = window.setTimeout(() => {
			setSceneInteracting(false);
			interactionTimeoutRef.current = null;
		}, 100);
	}, [setSceneInteracting]);

	const endInteracting = useCallback(() => {
		if(interactionTimeoutRef.current){
			window.clearTimeout(interactionTimeoutRef.current);
			interactionTimeoutRef.current = null;
		}
		setSceneInteracting(false);
	}, [setSceneInteracting]);

	const backgroundColor = useMemo(() => {
		if(background !== null && background !== undefined) return background;
		return !showEditorWidgets ? '#FFF' : '#000';
	}, [showEditorWidgets, background]);

	const handleToolsReady = useCallback((t: {
		captureScreenshot: (options?: any) => Promise<string>;
		waitForVisibleFrame: () => Promise<void>;
		markContentReady: () => void;
		waitForContentFrame: () => Promise<void>;
	}) => { setTools(() => t); }, []);

	useImperativeHandle(ref, () => ({
		captureScreenshot: (options) => {
			if(tools && typeof tools.captureScreenshot === 'function') return tools.captureScreenshot(options);
			return Promise.reject(new Error('Screenshot not available yet.'));
		},
		waitForVisibleFrame: () => tools?.waitForVisibleFrame?.() ?? Promise.resolve(),
		markContentReady: () => tools?.markContentReady?.(),
		waitForContentFrame: () => tools?.waitForContentFrame?.() ?? Promise.resolve(),
		zoomTo: (zoomPercent: number) => {
			if(!orbitControlsRef.current) return;
			const controls = orbitControlsRef.current;
			const camera = controls.object as THREE.PerspectiveCamera;

			// Initialize the reference distance on first call
			if(!initialDistanceRef.current){
				initialDistanceRef.current = camera.position.distanceTo(controls.target);
			}

			// Calculate target distance based on zoom percentage
			// 100% = initial distance
			// 50% = 2x farther away
			// 200% = 0.5x distance(2x closer)
			const targetDistance = initialDistanceRef.current * (100 / zoomPercent);
			const currentPosition = camera.position.clone();
			const direction = currentPosition.clone().sub(controls.target).normalize();

			// Calculate new camera position
			const newPosition = controls.target.clone().addScaledVector(direction, targetDistance);

			// Apply distance constraints from OrbitControls
			const clampedDistance = Math.max(
				controls.minDistance,
				Math.min(controls.maxDistance, targetDistance)
			);
			const clampedPosition = controls.target.clone().addScaledVector(direction, clampedDistance);

			// Set camera position directly
			camera.position.copy(clampedPosition);

			controls.update();
		},
		getCurrentZoom: () => {
			if(!orbitControlsRef.current) return 100;
			const controls = orbitControlsRef.current;
			const camera = controls.object as THREE.PerspectiveCamera;

			// Initialize reference distance on first call if not already done
			if(!initialDistanceRef.current){
				initialDistanceRef.current = camera.position.distanceTo(controls.target);
			}

			// Calculate current distance
			const currentDistance = camera.position.distanceTo(controls.target);

			const zoomPercent = (initialDistanceRef.current * 100) / currentDistance;

			// Round to nearest preset or to nearest 5%
			const roundedZoom = Math.round(zoomPercent / 5) * 5;

			// Clamp between 10% and 1000%
			return Math.max(10, Math.min(1000, roundedZoom));
		}
	}), [tools]);

	const handleControlsRef = useCallback((r: any) => {
		orbitControlsRef.current = r;
		onCameraControlsRef?.(r);
	}, [onCameraControlsRef]);

	useEffect(() => {
		if(!orbitControlsRef.current) return;
		orbitControlsRef.current.target.set(ocTarget[0], ocTarget[1], ocTarget[2]);
		orbitControlsRef.current.update();
	}, [ocTarget[0], ocTarget[1], ocTarget[2]]);

	// Initialize zoom reference distance when OrbitControls is ready
	useEffect(() => {
		const initializeZoom = () => {
			if(!orbitControlsRef.current || initialDistanceRef.current) return true;
			const controls = orbitControlsRef.current;
			const camera = controls.object as any;
			initialDistanceRef.current = camera.position.distanceTo(controls.target);
			return true;
		};

		// Try to initialize immediately
		if(!initializeZoom()) {
			// If not ready, retry on next frame
			const timer = setTimeout(initializeZoom, 100);
			return () => clearTimeout(timer);
		}
	}, []);

	const { isDefectScene, isTrajectoryScene } = useMemo(() => {
		// TODO: Implement proper scene type detection using plugin workflow data
		return { isDefectScene: false, isTrajectoryScene: true };
	}, [activeScene]);

	const canvasStyle = useMemo(() => ({
		width: '100%',
		height: '100%',
      ...(cssBackground ? { background: cssBackground } : { backgroundColor }),
		touchAction: 'none',
		willChange: 'transform',
		transform: 'translateZ(0)'
	}), [backgroundColor, cssBackground]);

	const threeBackgroundColor = useMemo(() => {
		if(cssBackground && rCreate.alpha) return 'transparent';
		return backgroundColor;
	}, [cssBackground, rCreate.alpha, backgroundColor]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if(e.ctrlKey && e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleCanvasGrid(); }
			if(e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); toggleEditorWidgets(); }
			if(e.ctrlKey && e.altKey && e.key.toLowerCase() === 'z') {
				e.preventDefault();
				if(orbitControlsRef.current){
					const optimal = calculateClosestCameraPositionZY(activeModel?.modelBounds.box, orbitControlsRef.current.object);
					orbitControlsRef.current.object.position.copy(optimal.position);
					orbitControlsRef.current.target.copy(optimal.target);
					orbitControlsRef.current.object.up.copy(optimal.up);
					orbitControlsRef.current.object.lookAt(optimal.target);
					orbitControlsRef.current.update();
				}
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => { window.removeEventListener('keydown', handleKeyDown); };
	}, [tools, toggleCanvasGrid, toggleEditorWidgets, activeModel]);

	useEffect(() => {
		return () => {
			if(interactionTimeoutRef.current){
				window.clearTimeout(interactionTimeoutRef.current);
			}
		};
	}, []);

	const glProps = useMemo(() => ({
		antialias: rCreate.antialias,
		alpha: rCreate.alpha,
		depth: rCreate.depth,
		stencil: rCreate.stencil,
		logarithmicDepthBuffer: rCreate.logarithmicDepthBuffer,
		preserveDrawingBuffer: rCreate.preserveDrawingBuffer,
		powerPreference
	}), [rCreate.antialias, rCreate.alpha, rCreate.depth, rCreate.stencil, rCreate.logarithmicDepthBuffer, rCreate.preserveDrawingBuffer, powerPreference]);

	return (
		<div style={{ width: '100%', height: '100%' }}>
			<Canvas
				gl={glProps}
				style={canvasStyle}
				dpr={dpr}
				frameloop="demand"
				performance={perf}
				onCreated={() => { }}
			>
				<DynamicRenderer />
				<CameraRig orbitRef={orbitControlsRef} />
				<ScreenshotHandler onToolsReady={handleToolsReady} backgroundColor={backgroundColor} />
				<color attach="background" args={[threeBackgroundColor]} />
				<Preload all />
				{adaptiveEnabled && <AdaptiveDpr pixelated={pixelated} />}
				{adaptiveEventsEnabled && <AdaptiveEvents />}

				{showGizmo && (
					<GizmoHelper alignment="top-left" renderPriority={2} margin={[450, 70]}>
						<directionalLight position={[5, 5, 5]} intensity={1} />
						<ambientLight intensity={0.7} />
						<GizmoViewport scale={30} hideNegativeAxes axisColors={['#404040', '#404040', '#404040']} labelColor="#a2a2a2" />
					</GizmoHelper>
				)}

				<DynamicBackground />
				<DynamicEffects />
				<DynamicLights />
				<DynamicEnvironment />

				{isDefectScene && <DefectLighting />}
				{isTrajectoryScene && <TrajectoryLighting />}

				<OrbitControls
					ref={handleControlsRef}
					enabled={ocEnabled && cameraControlsEnabled}
					enableDamping={ocEnableDamping}
					dampingFactor={ocDampingFactor}
					enableZoom={ocEnableZoom}
					zoomSpeed={ocZoomSpeed}
					enableRotate={ocEnableRotate}
					rotateSpeed={ocRotateSpeed}
					enablePan={ocEnablePan}
					panSpeed={ocPanSpeed}
					screenSpacePanning={ocScreenSpacePanning}
					autoRotate={ocAutoRotate}
					autoRotateSpeed={ocAutoRotateSpeed}
					minDistance={ocMinDistance}
					maxDistance={ocMaxDistance}
					minPolarAngle={ocMinPolar}
					maxPolarAngle={ocMaxPolar}
					minAzimuthAngle={ocMinAzimuth}
					maxAzimuthAngle={ocMaxAzimuth}
					onStart={markInteractingNow}
					onChange={markInteractingDebounced}
					onEnd={endInteracting}
					{...orbitControlsConfig}
				/>

				{showCanvasGrid && <CanvasGrid />}

				<Bvh firstHitOnly>
					{children}
				</Bvh>

				<EffectComposer enableNormalPass={isDefectScene} multisampling={0} renderPriority={1}>
					{isDefectScene && <SSAO {...useRenderConfigStoreShim().SSAO} />}
				</EffectComposer>
			</Canvas>
		</div>
	);
});

const useRenderConfigStoreShim = () => {
	return {
		SSAO: { intensity: 5, radius: 0.1, luminanceInfluence: 0.5, worldDistanceThreshold: 0.5, worldDistanceFalloff: 0.3, worldProximityThreshold: 0.5, worldProximityFalloff: 0.3 }
	};
};

Scene3D.displayName = 'Scene3D';
export default React.memo(Scene3D);
