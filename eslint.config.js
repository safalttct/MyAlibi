// @ts-check
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', '.angular/**', 'node_modules/**', 'out-tsc/**', 'src/environments/environment.generated.ts'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: ['app', 'ui'], style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        // Element components use kebab-case (`app-*`/`ui-*`); styled native controls
        // use attribute selectors such as `button[uiButton]`.
        { type: ['element', 'attribute'], prefix: ['app', 'ui'], style: 'kebab-case' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    },
  },
  {
    // Styled native controls (`button[uiButton]`) intentionally use compound attribute selectors.
    files: ['src/app/shared/ui/ui-button.ts', 'src/app/shared/ui/ui-input.ts', 'src/app/shared/ui/ui-select.ts'],
    rules: { '@angular-eslint/component-selector': 'off' },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {},
  },
);
