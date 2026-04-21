import * as THREE from 'three';

interface ShaderDescriptor {
    vertex: string;
    fragment: string;
    defines?: Record<string, string | number | boolean>;
}

interface IncludeDictionary {
    [key: string]: string;
}

// Why: Shader registry inlines #include directives at build time (Vite's ?raw
// import emits literal text). We preprocess includes in JS before handing to
// three.js so shader hot-reload works reliably.
const INCLUDE_PATTERN = /^[ \t]*#include[ \t]+<([a-zA-Z0-9_/\-.]+)>[ \t]*$/gm;

const resolveIncludes = (source: string, includes: IncludeDictionary): string => {
    return source.replace(INCLUDE_PATTERN, (match, key: string) => {
        const replacement = includes[key];
        if (replacement === undefined) {
            return match;
        }
        return replacement;
    });
};

const hashDefines = (defines: Record<string, string | number | boolean> | undefined): string => {
    if (!defines) return '';
    const keys = Object.keys(defines).sort();
    return keys.map((key) => `${key}=${String(defines[key])}`).join('|');
};

const simpleHash = (value: string): string => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

interface RegisteredProgram {
    vertex: string;
    fragment: string;
    cacheKey: string;
}

class ShaderRegistry {
    private includes: IncludeDictionary = {};
    private programCache = new Map<string, RegisteredProgram>();

    registerInclude(key: string, source: string): void {
        this.includes[key] = source;
    }

    compile(descriptor: ShaderDescriptor): RegisteredProgram {
        const definesHash = hashDefines(descriptor.defines);
        const key = `${simpleHash(descriptor.vertex)}:${simpleHash(descriptor.fragment)}:${definesHash}`;
        const cached = this.programCache.get(key);
        if (cached) return cached;

        const program: RegisteredProgram = {
            vertex: resolveIncludes(descriptor.vertex, this.includes),
            fragment: resolveIncludes(descriptor.fragment, this.includes),
            cacheKey: key
        };

        this.programCache.set(key, program);
        return program;
    }

    createMaterial(
        descriptor: ShaderDescriptor,
        uniforms: Record<string, THREE.IUniform>,
        options: Omit<THREE.ShaderMaterialParameters, 'vertexShader' | 'fragmentShader' | 'uniforms' | 'defines'> = {}
    ): THREE.ShaderMaterial {
        const program = this.compile(descriptor);
        const material = new THREE.ShaderMaterial({
            ...options,
            vertexShader: program.vertex,
            fragmentShader: program.fragment,
            uniforms,
            defines: descriptor.defines as Record<string, string | number | boolean> | undefined
        });
        return material;
    }

    debugDump(): Record<string, { vertex: string; fragment: string }> {
        const out: Record<string, { vertex: string; fragment: string }> = {};
        for (const [key, value] of this.programCache.entries()) {
            out[key] = { vertex: value.vertex, fragment: value.fragment };
        }
        return out;
    }
}

import atomCommonLib from '@/modules/fractal/assets/shaders/lib/atom-common.glsl?raw';

const registry = new ShaderRegistry();
registry.registerInclude('volt/atom-common', atomCommonLib);

export const sharedShaderRegistry = registry;
