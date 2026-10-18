const path = require('path');
const { createRequire } = require('module');

const requireFromExpo = createRequire(require.resolve('expo/package.json'));
const expoModulesCoreDir = path.dirname(requireFromExpo.resolve('expo-modules-core/package.json'));

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.tsx'],
  clearMocks: true,
  moduleNameMapper: {
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    '^expo-modules-core(.*)$': `${expoModulesCoreDir}$1`,
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|lucide-react-native|react-native-svg))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
