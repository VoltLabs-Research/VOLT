import {
    resolveOutputColorSpace,
    resolveShadowMapType,
    resolveToneMapping
} from '@/shared/domain/rendering/renderer';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

import type { RendererRuntimeState } from '@/shared/domain/rendering/renderer';
import type { WebGLRenderer } from 'three';

interface DynamicRendererProps {
    settings: RendererRuntimeState;
}

interface WebGLRendererWithOutputColorSpace extends WebGLRenderer {
    outputColorSpace: string;
}

const DynamicRenderer = ({ settings }: DynamicRendererProps) => {
    const { gl } = useThree();

    useEffect(() => {
        gl.toneMapping = resolveToneMapping(settings.toneMapping);
    }, [gl, settings.toneMapping]);

    useEffect(() => {
        const renderer = gl as WebGLRendererWithOutputColorSpace;
        renderer.outputColorSpace = resolveOutputColorSpace(settings.outputColorSpace);
    }, [gl, settings.outputColorSpace]);

    useEffect(() => {
        gl.toneMappingExposure = settings.toneMappingExposure;
    }, [gl, settings.toneMappingExposure]);

    useEffect(() => {
        gl.shadowMap.enabled = settings.shadowEnabled;
        gl.shadowMap.autoUpdate = settings.shadowAutoUpdate;
        gl.shadowMap.type = resolveShadowMapType(settings.shadowType);
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
