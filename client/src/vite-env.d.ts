/// <reference types="vite/client" />
/// <reference types="./types/three.d.ts" />

import type { ThreeElements } from '@react-three/fiber'

declare global {
  namespace React {
    namespace JSX {
        interface IntrinsicElements extends ThreeElements {
        }
    }
  }

  interface ImportMetaEnv {
    readonly VITE_CPU_INTENSIVE_TASKS: string;
    // Add other environment variables here as needed
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}