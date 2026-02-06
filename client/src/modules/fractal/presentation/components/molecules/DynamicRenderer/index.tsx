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
import type { RendererRuntimeState } from '@/modules/fractal/presentation/types/stores/editor/performance-types';

interface DynamicRendererProps {
    settings: RendererRuntimeState;
}

const DynamicRenderer = ({ settings }: DynamicRendererProps) => {
    const { gl } = useThree();

    useEffect(() => {
        const tm =
            settings.toneMapping === 'ACESFilmic' ? ACESFilmicToneMapping :
            settings.toneMapping === 'AgX' ? AgXToneMapping :
            settings.toneMapping === 'Neutral' ? NeutralToneMapping :
            settings.toneMapping === 'Cineon' ? CineonToneMapping :
            settings.toneMapping === 'Reinhard' ? ReinhardToneMapping :
            settings.toneMapping === 'Linear' ? LinearToneMapping :
            NoToneMapping;
        gl.toneMapping = tm;
        gl.toneMappingExposure = settings.toneMappingExposure;
    }, [gl, settings.toneMapping, settings.toneMappingExposure]);

    useEffect(() => {
        const colorSpace =
            settings.outputColorSpace === 'LinearSRGB' ? LinearSRGBColorSpace :
            settings.outputColorSpace === 'DisplayP3' ? DisplayP3ColorSpace :
            settings.outputColorSpace === 'LinearDisplayP3' ? LinearDisplayP3ColorSpace :
            SRGBColorSpace;
        gl.outputColorSpace = colorSpace;
    }, [gl, settings.outputColorSpace]);

    useEffect(() => {
        gl.shadowMap.enabled = settings.shadowEnabled;
        gl.shadowMap.autoUpdate = settings.shadowAutoUpdate;
        gl.shadowMap.type =
            settings.shadowType === 'PCF' ? PCFShadowMap :
            settings.shadowType === 'PCFSoft' ? PCFSoftShadowMap :
            settings.shadowType === 'VSM' ? VSMShadowMap :
            BasicShadowMap;
        gl.shadowMap.needsUpdate = true;
    }, [gl, settings.shadowEnabled, settings.shadowType, settings.shadowAutoUpdate]);

    useEffect(() => {
        gl.localClippingEnabled = settings.localClippingEnabled;
    }, [gl, settings.localClippingEnabled]);

    useEffect(() => {
        gl.sortObjects = settings.sortObjects;
    }, [gl, settings.sortObjects]);

    useEffect(() => {
        gl.autoClear = settings.autoClear;
        gl.autoClearColor = settings.autoClearColor;
        gl.autoClearDepth = settings.autoClearDepth;
        gl.autoClearStencil = settings.autoClearStencil;
    }, [gl, settings.autoClear, settings.autoClearColor, settings.autoClearDepth, settings.autoClearStencil]);

    useEffect(() => {
        (gl as any).useLegacyLights = settings.useLegacyLights;
    }, [gl, settings.useLegacyLights]);

    useEffect(() => {
        if ((gl as any).gammaFactor !== undefined) {
            (gl as any).gammaFactor = settings.gammaFactor;
        }
    }, [gl, settings.gammaFactor]);

    useEffect(() => {
        (gl.capabilities as any).maxMorphTargets = settings.maxMorphTargets;
    }, [gl, settings.maxMorphTargets]);

    useEffect(() => {
        (gl.capabilities as any).maxMorphNormals = settings.maxMorphNormals;
    }, [gl, settings.maxMorphNormals]);

    return null;
};

export default DynamicRenderer;
