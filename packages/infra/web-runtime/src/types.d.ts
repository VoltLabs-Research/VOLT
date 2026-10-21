declare module 'crypto-browserify' {
    export * from 'node:crypto';
}

// Resolved by scripts/build.mjs to the built entry point of the backend being bundled.
declare module 'volt-backend-entry';
