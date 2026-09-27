const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

/*
 * The shared contract lives outside this package.
 *
 * Metro only watches the project root by default, so `@shared/contract` fails to
 * resolve the moment app code imports a *value* from it rather than a type —
 * types are erased at compile time and the bundler never sees them, which is why
 * this worked until the first real import.
 */
const shared = path.resolve(__dirname, '../shared');
config.watchFolders = [shared];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@shared': shared,
};

module.exports = withNativeWind(config, { input: './global.css' });
