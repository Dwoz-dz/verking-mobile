// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/types/*'],
  },
  {
    // Packages that may not be resolvable in CI / sandbox before `npm install`
    // completes. The TS ambient shims in types/modules.d.ts cover the type
    // side; this silences ESLint's import-resolver for them.
    rules: {
      'import/no-unresolved': [
        'error',
        {
          ignore: [
            '^i18next$',
            '^react-i18next$',
            '^intl-pluralrules$',
            '^expo-localization$',
            '^expo-updates$',
            '^@react-native-async-storage/async-storage$',
          ],
        },
      ],
    },
  },
]);
