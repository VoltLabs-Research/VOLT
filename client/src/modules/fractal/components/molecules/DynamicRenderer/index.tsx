import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
    ACESFilmicToneMapping,
    AgXToneMapping,
    NeutralToneMapping,
    CineonToneMapping,
    LinearToneMapping,
    NoToneMapping,
    PCFShadowMap,
    PCFSoftShadowMap,
    ReinhardToneMapping,
    VSMShadowMap,
    BasicShadowMap
} from 'three';
import type { ShadowMapType, ToneMapping, WebGLRenderer } from 'three';
import { OutputCS, ShadowType, ToneMappingMode } from '@/modules/fractal/stores/contracts/editor/performance-types';
import type { RendererRuntimeState } from '@/modules/fractal/stores/contracts/editor/performance-types';

interface DynamicRendererProps {
    settings: RendererRuntimeState;
};

interface WebGLRendererWithOutputColorSpace extends WebGLRenderer {
    outputColorSpace: string;
};

const DynamicRenderer = ({ settings }: DynamicRendererProps) => {
    const { gl } = useThree();

    useEffect(() => {
        let tm: ToneMapping = NoToneMapping;
        if (settings.toneMapping === ToneMappingMode.ACESFilmic) {
            tm = ACESFilmicToneMapping;
        } else if (settings.toneMapping === ToneMappingMode.AgX) {
            tm = AgXToneMapping;
        } else if (settings.toneMapping === ToneMappingMode.Neutral) {
            tm = NeutralToneMapping;
        } else if (settings.toneMapping === ToneMappingMode.Cineon) {
            tm = CineonToneMapping;
        } else if (settings.toneMapping === ToneMappingMode.Reinhard) {
            tm = ReinhardToneMapping;
        } else if (settings.toneMapping === ToneMappingMode.Linear) {
            tm = LinearToneMapping;
        }
        gl.toneMapping = tm;
        gl.toneMappingExposure = settings.toneMappingExposure;
    }, [gl, settings.toneMapping, settings.toneMappingExposure]);

    useEffect(() => {
        let colorSpace = 'srgb';
        if (settings.outputColorSpace === OutputCS.LinearSRGB) {
            colorSpace = 'srgb-linear';
        }
        const renderer = gl as WebGLRendererWithOutputColorSpace;
        renderer.outputColorSpace = colorSpace;
    }, [gl, settings.outputColorSpace]);

    useEffect(() => {
        gl.shadowMap.enabled = settings.shadowEnabled;
        gl.shadowMap.autoUpdate = settings.shadowAutoUpdate;
        let shadowType: ShadowMapType = BasicShadowMap;
        if (settings.shadowType === ShadowType.PCF) {
            shadowType = PCFShadowMap;
        } else if (settings.shadowType === ShadowType.PCFSoft) {
            shadowType = PCFSoftShadowMap;
        } else if (settings.shadowType === ShadowType.VSM) {
            shadowType = VSMShadowMap;
        }
        gl.shadowMap.type = shadowType;
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

    return null;
};

export default DynamicRenderer;
