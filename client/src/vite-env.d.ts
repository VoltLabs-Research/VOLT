/// <reference types="vite/client" />
import '@react-three/fiber';
import type { VoltDesktopApi } from '@/shared/utils/electron-contract';

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
};

interface ImportMeta {
    readonly env: ImportMetaEnv;
};

declare global {
    interface Window {
        voltDesktop?: VoltDesktopApi;
    };
}
