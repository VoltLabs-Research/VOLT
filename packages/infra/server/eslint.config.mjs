import { backendEslintConfig } from '@volt/tooling/eslint-backend';

export default backendEslintConfig({
    files: [
        'src/**/*.ts',
        'tools/**/*.ts',
        'scripts/**/*.ts'
    ]
});
