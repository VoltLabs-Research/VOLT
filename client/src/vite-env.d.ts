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
}