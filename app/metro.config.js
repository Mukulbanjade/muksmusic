// Default Expo Metro config. Expo enables tsconfig `paths` (the `@/*` alias)
// resolution by default, so this file just ensures the standard setup is used.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

module.exports = config;
