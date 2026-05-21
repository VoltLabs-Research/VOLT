import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [
        'src/index.ts',
        'src/argument-visibility.ts',
        'src/binary-envelope.ts',
        'src/lammps.ts',
        'src/plugin-reference.ts'
    ],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true
});
