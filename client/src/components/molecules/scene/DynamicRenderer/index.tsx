import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
	ACESFilmicToneMapping,
	CineonToneMapping,
	LinearSRGBColorSpace,
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
	const toneMapping = useEditorStore((s) => s.rendererSettings.runtime.toneMapping);
	const exposure = useEditorStore((s) => s.rendererSettings.runtime.toneMappingExposure);
	const outputCS = useEditorStore((s) => s.rendererSettings.runtime.outputColorSpace);
	const pcl = useEditorStore((s) => s.rendererSettings.runtime.physicallyCorrectLights);
	const clipping = useEditorStore((s) => s.rendererSettings.runtime.localClippingEnabled);
	const autoClear = useEditorStore((s) => s.rendererSettings.runtime.autoClear);
	const shadowEnabled = useEditorStore((s) => s.rendererSettings.runtime.shadowEnabled);
	const shadowType = useEditorStore((s) => s.rendererSettings.runtime.shadowType);

	useEffect(() => {
		const tm =
			toneMapping === 'ACESFilmic' ? ACESFilmicToneMapping :
				toneMapping === 'Cineon' ? CineonToneMapping :
					toneMapping === 'Reinhard' ? ReinhardToneMapping :
						toneMapping === 'Linear' ? LinearToneMapping :
							NoToneMapping;
		gl.toneMapping = tm;
		gl.toneMappingExposure = exposure;
	}, [gl, toneMapping, exposure]);

	useEffect(() => {
		gl.outputColorSpace = outputCS === 'LinearSRGB' ? LinearSRGBColorSpace : SRGBColorSpace;
	}, [gl, outputCS]);

	useEffect(() => {
		gl.physicallyCorrectLights = pcl;
	}, [gl, pcl]);

	useEffect(() => {
		gl.localClippingEnabled = clipping;
	}, [gl, clipping]);

	useEffect(() => {
		gl.autoClear = autoClear;
	}, [gl, autoClear]);

	useEffect(() => {
		gl.shadowMap.enabled = shadowEnabled;
		gl.shadowMap.type =
			shadowType === 'PCF' ? PCFShadowMap :
				shadowType === 'PCFSoft' ? PCFSoftShadowMap :
					shadowType === 'VSM' ? VSMShadowMap :
						BasicShadowMap;
	}, [gl, shadowEnabled, shadowType]);

	return null;
};

export default DynamicRenderer;
