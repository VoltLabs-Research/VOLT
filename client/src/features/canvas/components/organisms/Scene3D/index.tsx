import React, {
	useEffect,
	useMemo,
	useState,
	useRef,
	useCallback,
	forwardRef,
	useImperativeHandle
} from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, AdaptiveDpr, AdaptiveEvents, Bvh, Preload } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import TrajectoryLighting from '@/features/canvas/components/atoms/TrajectoryLighting';
import DefectLighting from '@/features/canvas/components/atoms/DefectLighting';
import CanvasGrid from '@/features/canvas/components/atoms/CanvasGrid';
import DynamicEffects from '@/features/canvas/components/molecules/DynamicEffects';
import DynamicEnvironment from '@/features/canvas/components/molecules/DynamicEnvironment';
import DynamicLights from '@/features/canvas/components/molecules/DynamicLights';
import DynamicBackground from '@/features/canvas/components/molecules/DynamicBackground';
import DynamicRenderer from '@/features/canvas/components/molecules/DynamicRenderer';
import CameraRig from '@/features/canvas/components/atoms/CameraRig';
import PerformanceStatsCollector from '@/features/canvas/components/atoms/PerformanceStatsCollector';
import { useUIStore } from '@/stores/slices/ui';
import { useEditorStore } from '@/features/canvas/stores/editor';
import { calculateClosestCameraPositionZY } from '@/features/canvas/utilities/modelUtils';
import '@/features/canvas/components/organisms/Scene3D/Scene3D.css';

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

	const activeScene = useEditorStore((s) => s.activeScene);
	const activeModel = useEditorStore((s) => s.activeModel);

	const toggleCanvasGrid = useUIStore((s) => s.toggleCanvasGrid);
	const toggleEditorWidgets = useUIStore((s) => s.toggleEditorWidgets);
	const showEditorWidgets = useUIStore((s) => s.showEditorWidgets);
	const setSceneInteracting = useUIStore((s) => s.setSceneInteracting);
	const isInteracting = useUIStore((s) => s.isSceneInteracting);

	useEditorStore((s) => s.camera.type);
	useEditorStore((s) => s.camera.position);
	useEditorStore((s) => s.camera.up);

	const dprCfg = useEditorStore((s) => s.performanceSettings.dpr);
	const perf = useEditorStore((s) => s.performanceSettings.performance);
	const interactionDegradeEnabled = useEditorStore((s) => s.performanceSettings.interactionDegrade.enabled);
	const powerPreference = useEditorStore((s) => s.performanceSettings.canvas.powerPreference);
	const adaptiveEventsEnabled = useEditorStore((s) => s.performanceSettings.adaptiveEvents.enabled);

	const rCreate = useEditorStore((s) => s.rendererSettings.create);

	const ocEnabled = useEditorStore((s) => s.orbitControls.enabled);
	const ocEnableDamping = useEditorStore((s) => s.orbitControls.enableDamping);
	const ocDampingFactor = useEditorStore((s) => s.orbitControls.dampingFactor);
	const ocEnableZoom = useEditorStore((s) => s.orbitControls.enableZoom);
	const ocZoomSpeed = useEditorStore((s) => s.orbitControls.zoomSpeed);
	const ocEnableRotate = useEditorStore((s) => s.orbitControls.enableRotate);
	const ocRotateSpeed = useEditorStore((s) => s.orbitControls.rotateSpeed);
	const ocEnablePan = useEditorStore((s) => s.orbitControls.enablePan);
	const ocPanSpeed = useEditorStore((s) => s.orbitControls.panSpeed);
	const ocScreenSpacePanning = useEditorStore((s) => s.orbitControls.screenSpacePanning);
	const ocAutoRotate = useEditorStore((s) => s.orbitControls.autoRotate);
	const ocAutoRotateSpeed = useEditorStore((s) => s.orbitControls.autoRotateSpeed);
	const ocMinDistance = useEditorStore((s) => s.orbitControls.minDistance);
	const ocMaxDistance = useEditorStore((s) => s.orbitControls.maxDistance);
	const ocMinPolar = useEditorStore((s) => s.orbitControls.minPolarAngle);
	const ocMaxPolar = useEditorStore((s) => s.orbitControls.maxPolarAngle);
	const ocMinAzimuth = useEditorStore((s) => s.orbitControls.minAzimuthAngle);
	const ocMaxAzimuth = useEditorStore((s) => s.orbitControls.maxAzimuthAngle);
	const ocTarget = useEditorStore((s) => s.orbitControls.target);

	const dpr = useMemo(() => {
		if (dprCfg.mode === 'fixed') return dprCfg.fixed;
		const min = (isInteracting && interactionDegradeEnabled) ? Math.min(dprCfg.interactionMin, dprCfg.min) : dprCfg.min;
		return [min, dprCfg.max] as [number, number];
	}, [dprCfg.mode, dprCfg.fixed, dprCfg.min, dprCfg.max, dprCfg.interactionMin, interactionDegradeEnabled, isInteracting]);

	const adaptiveEnabled = dprCfg.mode === 'adaptive';
	const pixelated = dprCfg.pixelated;

	const markInteractingNow = useCallback(() => { setSceneInteracting(true); }, [setSceneInteracting]);

	const markInteractingDebounced = useCallback(() => {
		setSceneInteracting(true);
		if (interactionTimeoutRef.current) window.clearTimeout(interactionTimeoutRef.current);
		interactionTimeoutRef.current = window.setTimeout(() => {
			setSceneInteracting(false);
			interactionTimeoutRef.current = null;
		}, 100);
	}, [setSceneInteracting]);

	const endInteracting = useCallback(() => {
		if (interactionTimeoutRef.current) {
			window.clearTimeout(interactionTimeoutRef.current);
			interactionTimeoutRef.current = null;
		}
		setSceneInteracting(false);
	}, [setSceneInteracting]);

	const backgroundColor = useMemo(() => {
		if (background !== null && background !== undefined) return background;
		return '#0a0a0a';
	}, [background]);

	const handleToolsReady = useCallback((t: {
		captureScreenshot: (options?: any) => Promise<string>;
		waitForVisibleFrame: () => Promise<void>;
		markContentReady: () => void;
		waitForContentFrame: () => Promise<void>;
	}) => { setTools(() => t); }, []);

	useImperativeHandle(ref, () => ({
		captureScreenshot: (options) => {
			if (tools && typeof tools.captureScreenshot === 'function') return tools.captureScreenshot(options);
			return Promise.reject(new Error('Screenshot not available yet.'));
		},
		waitForVisibleFrame: () => tools?.waitForVisibleFrame?.() ?? Promise.resolve(),
		markContentReady: () => tools?.markContentReady?.(),
		waitForContentFrame: () => tools?.waitForContentFrame?.() ?? Promise.resolve(),
		zoomTo: (zoomPercent: number) => {
			if (!orbitControlsRef.current) return;
			const controls = orbitControlsRef.current;
			const camera = controls.object as THREE.PerspectiveCamera;

			// Initialize the reference distance on first call
			if (!initialDistanceRef.current) {
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
			if (!orbitControlsRef.current) return 100;
			const controls = orbitControlsRef.current;
			const camera = controls.object as THREE.PerspectiveCamera;

			// Initialize reference distance on first call if not already done
			if (!initialDistanceRef.current) {
				initialDistanceRef.current = camera.position.distanceTo(controls.target);
			}

			// Calculate current distance
			const currentDistance = camera.position.distanceTo(controls.target);

			const zoomPercent = (initialDistanceRef.current * 100) / currentDistance;

			// Round to nearest preset or to nearest 5%
			const roundedZoom = Math.round(zoomPercent / 5) * 5;

			// Rounding also between 10% and 1000%
			return Math.max(10, Math.min(1000, roundedZoom));
		}
	}), [tools]);

	const handleControlsRef = useCallback((r: any) => {
		orbitControlsRef.current = r;
		onCameraControlsRef?.(r);
	}, [onCameraControlsRef]);

	useEffect(() => {
		if (!orbitControlsRef.current) return;
		orbitControlsRef.current.target.set(ocTarget[0], ocTarget[1], ocTarget[2]);
		orbitControlsRef.current.update();
	}, [ocTarget[0], ocTarget[1], ocTarget[2]]);

	// Initialize zoom reference distance when OrbitControls is ready
	useEffect(() => {
		const initializeZoom = () => {
			if (!orbitControlsRef.current || initialDistanceRef.current) return true;
			const controls = orbitControlsRef.current;
			const camera = controls.object as any;
			initialDistanceRef.current = camera.position.distanceTo(controls.target);
			return true;
		};

		// Try to initialize immediately
		if (!initializeZoom()) {
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
		touchAction: 'none',
		willChange: 'transform',
		transform: 'translateZ(0)'
	}), [backgroundColor, cssBackground]);

	const threeBackgroundColor = useMemo(() => {
		if (cssBackground && rCreate.alpha) return 'transparent';
		return backgroundColor;
	}, [cssBackground, rCreate.alpha, backgroundColor]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleCanvasGrid(); }
			if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); toggleEditorWidgets(); }
			if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'z') {
				e.preventDefault();
				if (orbitControlsRef.current) {
					const optimal = calculateClosestCameraPositionZY(activeModel?.modelBounds?.box, orbitControlsRef.current.object);
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

	// Listen for custom camera command events from keyboard shortcuts
	useEffect(() => {
		const handleCameraCommand = (e: CustomEvent<{ command: string }>) => {
			if (!orbitControlsRef.current) return;

			const { command } = e.detail;

			if (command === 'reset-camera') {
				// Reset to default camera position
				orbitControlsRef.current.object.position.set(8, 8, 6);
				orbitControlsRef.current.object.up.set(0, 0, 1);
				orbitControlsRef.current.target.set(0, 0, 0);
				orbitControlsRef.current.object.lookAt(0, 0, 0);
				orbitControlsRef.current.update();
			}
		};

		window.addEventListener('volterra:camera-command', handleCameraCommand as EventListener);
		return () => {
			window.removeEventListener('volterra:camera-command', handleCameraCommand as EventListener);
		};
	}, []);

	useEffect(() => {
		return () => {
			if (interactionTimeoutRef.current) {
				window.clearTimeout(interactionTimeoutRef.current);
			}
		};
	}, []);

	const glProps = useMemo(() => ({
		// Anti-aliasing & Alpha
		antialias: rCreate.antialias,
		alpha: rCreate.alpha,

		// Buffers
		depth: rCreate.depth,
		stencil: rCreate.stencil,
		logarithmicDepthBuffer: rCreate.logarithmicDepthBuffer,
		preserveDrawingBuffer: rCreate.preserveDrawingBuffer,

		// Advanced WebGL Context
		premultipliedAlpha: rCreate.premultipliedAlpha,
		failIfMajorPerformanceCaveat: rCreate.failIfMajorPerformanceCaveat,
		precision: rCreate.precision,

		// Power Preference
		powerPreference
	}), [
		rCreate.antialias,
		rCreate.alpha,
		rCreate.depth,
		rCreate.stencil,
		rCreate.logarithmicDepthBuffer,
		rCreate.preserveDrawingBuffer,
		rCreate.premultipliedAlpha,
		rCreate.failIfMajorPerformanceCaveat,
		rCreate.precision,
		powerPreference
	]);

	// Generate a key for Canvas to force recreation when GL Create settings change
	const canvasKey = useMemo(() => {
		return `canvas-${rCreate.antialias}-${rCreate.alpha}-${rCreate.depth}-${rCreate.stencil}-${rCreate.logarithmicDepthBuffer}-${rCreate.preserveDrawingBuffer}-${rCreate.premultipliedAlpha}-${rCreate.failIfMajorPerformanceCaveat}-${rCreate.precision}`;
	}, [
		rCreate.antialias,
		rCreate.alpha,
		rCreate.depth,
		rCreate.stencil,
		rCreate.logarithmicDepthBuffer,
		rCreate.preserveDrawingBuffer,
		rCreate.premultipliedAlpha,
		rCreate.failIfMajorPerformanceCaveat,
		rCreate.precision
	]);

	return (
		<div style={{ width: '100%', height: '100%' }}>
			<Canvas
				key={canvasKey}
				gl={glProps}
				style={canvasStyle}
				dpr={dpr}
				frameloop="demand"
				performance={perf}
				onCreated={() => { }}
			>
				<DynamicRenderer />
				<CameraRig orbitRef={orbitControlsRef} />
				<PerformanceStatsCollector />
				<color attach="background" args={[threeBackgroundColor]} />
				<Preload all />
				{adaptiveEnabled && <AdaptiveDpr pixelated={pixelated} />}
				{adaptiveEventsEnabled && <AdaptiveEvents />}

				{showGizmo && (
					<GizmoHelper alignment="top-left" renderPriority={2} margin={[450, 70]}>
						<directionalLight position={[5, 5, 5]} intensity={1} />
						<ambientLight intensity={0.7} />
						<GizmoViewport scale={30} hideNegativeAxes axisColors={['#2c2c2e', '#2c2c2e', '#2c2c2e']} labelColor="#8e8e93" />
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
					{isDefectScene && <SSAO {...useEditorStore.getState().renderConfig.SSAO} />}
				</EffectComposer>
			</Canvas>
		</div>
	);
});


Scene3D.displayName = 'Scene3D';
export default React.memo(Scene3D);
