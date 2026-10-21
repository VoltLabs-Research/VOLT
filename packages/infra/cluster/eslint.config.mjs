import { backendEslintConfig } from '@volt/tooling/eslint-backend';

export default backendEslintConfig({
    files: [
        'src/**/*.ts',
        'scripts/**/*.ts'
    ],
    ignores: ['.runtime/**']
});
