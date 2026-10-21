import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

export const backendEslintConfig = ({ files, ignores = [] }) => tseslint.config(
    {
        ignores: ['dist/**', 'node_modules/**', ...ignores]
    },
    tseslint.configs.base,
    {
        files,
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
                        message: 'shared/ must not value-import from @modules/*. Use `import type`, or wire it through @shared/contracts.'
                    }
                ]
            }]
        }
    }
);
