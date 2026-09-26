// Metro configuration for Expo in Turborepo monorepo
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Obserwacja wszystkich pakietów w monorepo (np. packages/contracts)
config.watchFolders = [monorepoRoot];

// 2. Wyszukiwanie pakietów node_modules w korzeniu monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
