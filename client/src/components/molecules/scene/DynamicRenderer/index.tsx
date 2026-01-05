import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
	ACESFilmicToneMapping,
	AgXToneMapping,
	NeutralToneMapping,
	CineonToneMapping,
	LinearSRGBColorSpace,
	DisplayP3ColorSpace,
	LinearDisplayP3ColorSpace,
	LinearToneMapping,
	NoToneMapping,
	PCFShadowMap,
	PCFSoftShadowMap,
	ReinhardToneMapping,
	SRGBColorSpace,
	VSMShadowMap,
	BasicShadowMap
} from 'three';
import { useEditorStore } from '@/stores/slices/editor';

const DynamicRenderer = () => {
	const { gl } = useThree();

	// Tone Mapping & Color
	const toneMapping = useEditorStore((s) => s.rendererSettings.runtime.toneMapping);
	const exposure = useEditorStore((s) => s.rendererSettings.runtime.toneMappingExposure);
	const outputCS = useEditorStore((s) => s.rendererSettings.runtime.outputColorSpace);

	// Shadow Settings
	const shadowEnabled = useEditorStore((s) => s.rendererSettings.runtime.shadowEnabled);
	const shadowType = useEditorStore((s) => s.rendererSettings.runtime.shadowType);
	const shadowAutoUpdate = useEditorStore((s) => s.rendererSettings.runtime.shadowAutoUpdate);

	// Clipping & Culling
	const clipping = useEditorStore((s) => s.rendererSettings.runtime.localClippingEnabled);
	const sortObjects = useEditorStore((s) => s.rendererSettings.runtime.sortObjects);

	// Buffer Clearing
	const autoClear = useEditorStore((s) => s.rendererSettings.runtime.autoClear);
	const autoClearColor = useEditorStore((s) => s.rendererSettings.runtime.autoClearColor);
	const autoClearDepth = useEditorStore((s) => s.rendererSettings.runtime.autoClearDepth);
	const autoClearStencil = useEditorStore((s) => s.rendererSettings.runtime.autoClearStencil);

	// Advanced Rendering
	const useLegacyLights = useEditorStore((s) => s.rendererSettings.runtime.useLegacyLights);

	// Performance & Quality
	const gammaFactor = useEditorStore((s) => s.rendererSettings.runtime.gammaFactor);
	const maxMorphTargets = useEditorStore((s) => s.rendererSettings.runtime.maxMorphTargets);
	const maxMorphNormals = useEditorStore((s) => s.rendererSettings.runtime.maxMorphNormals);

	// Tone Mapping & Exposure
	useEffect(() => {
		const tm =
			toneMapping === 'ACESFilmic' ? ACESFilmicToneMapping :
			toneMapping === 'AgX' ? AgXToneMapping :
			toneMapping === 'Neutral' ? NeutralToneMapping :
			toneMapping === 'Cineon' ? CineonToneMapping :
			toneMapping === 'Reinhard' ? ReinhardToneMapping :
			toneMapping === 'Linear' ? LinearToneMapping :
			NoToneMapping;
		gl.toneMapping = tm;
		gl.toneMappingExposure = exposure;
	}, [gl, toneMapping, exposure]);

	// Output Color Space
	useEffect(() => {
		const colorSpace =
			outputCS === 'LinearSRGB' ? LinearSRGBColorSpace :
			outputCS === 'DisplayP3' ? DisplayP3ColorSpace :
			outputCS === 'LinearDisplayP3' ? LinearDisplayP3ColorSpace :
			SRGBColorSpace;
		gl.outputColorSpace = colorSpace;
	}, [gl, outputCS]);

	// Shadow Configuration
	useEffect(() => {
		gl.shadowMap.enabled = shadowEnabled;
		gl.shadowMap.autoUpdate = shadowAutoUpdate;
		gl.shadowMap.type =
			shadowType === 'PCF' ? PCFShadowMap :
			shadowType === 'PCFSoft' ? PCFSoftShadowMap :
			shadowType === 'VSM' ? VSMShadowMap :
			BasicShadowMap;
		gl.shadowMap.needsUpdate = true;
	}, [gl, shadowEnabled, shadowType, shadowAutoUpdate]);

	// Clipping & Culling
	useEffect(() => {
		gl.localClippingEnabled = clipping;
	}, [gl, clipping]);

	useEffect(() => {
		gl.sortObjects = sortObjects;
	}, [gl, sortObjects]);

	// Buffer Clearing
	useEffect(() => {
		gl.autoClear = autoClear;
		gl.autoClearColor = autoClearColor;
		gl.autoClearDepth = autoClearDepth;
		gl.autoClearStencil = autoClearStencil;
	}, [gl, autoClear, autoClearColor, autoClearDepth, autoClearStencil]);

	// Advanced Rendering
	useEffect(() => {
		(gl as any).useLegacyLights = useLegacyLights;
	}, [gl, useLegacyLights]);

	// Performance & Quality
	useEffect(() => {
		// gammaFactor is deprecated but still available for legacy support
		if ((gl as any).gammaFactor !== undefined) {
			(gl as any).gammaFactor = gammaFactor;
		}
	}, [gl, gammaFactor]);

	useEffect(() => {
		(gl.capabilities as any).maxMorphTargets = maxMorphTargets;
	}, [gl, maxMorphTargets]);

	useEffect(() => {
		(gl.capabilities as any).maxMorphNormals = maxMorphNormals;
	}, [gl, maxMorphNormals]);

	return null;
};

export default DynamicRenderer;
