import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            '.runtime/**'
        ]
    },
    tseslint.configs.base,
    {
        files: [
            'src/**/*.ts',
            'scripts/**/*.ts'
        ],
        plugins: {
            '@stylistic': stylistic
        },
        rules: {
            '@stylistic/object-curly-newline': ['error', {
                ObjectExpression: {
                    multiline: true,
                    minProperties: 2,
                    consistent: true
                }
            }]
        }
    },
    {
        files: ['src/shared/**/*.ts'],
        rules: {
            '@typescript-eslint/no-restricted-imports': ['error', {
                patterns: [
                    {
                        group: ['@modules/*', '@modules/**'],
                        allowTypeImports: true,
                        message: 'shared/ must not value-import from @modules/*. Use `import type`, or wire via @shared/contracts.'
                    }
                ]
            }]
        }
    }
);
