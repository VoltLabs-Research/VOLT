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
    BasicShadowMap } from 'three';
import useRendererSettings from '@/stores/editor/renderer-settings';

const DynamicRenderer = () => {
	const { gl } = useThree();
	const toneMapping = useRendererSettings((s) => s.runtime.toneMapping);
	const exposure = useRendererSettings((s) => s.runtime.toneMappingExposure);
	const outputCS = useRendererSettings((s) => s.runtime.outputColorSpace);
	const pcl = useRendererSettings((s) => s.runtime.physicallyCorrectLights);
	const clipping = useRendererSettings((s) => s.runtime.localClippingEnabled);
	const autoClear = useRendererSettings((s) => s.runtime.autoClear);
	const shadowEnabled = useRendererSettings((s) => s.runtime.shadowEnabled);
	const shadowType = useRendererSettings((s) => s.runtime.shadowType);

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
