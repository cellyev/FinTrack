// metro.config.js — FinTrack Build Size Optimization
// Excludes unused @expo/vector-icons font families from the bundle.
// Only Ionicons (used in tab nav + history screen) and Feather (used in home, input, analytics)
// are actually imported in the source code.

/* eslint-disable @typescript-eslint/no-require-imports */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Font families that are ACTUALLY used in the source code.
// Verified by scanning all .ts/.tsx files for `from '@expo/vector-icons'` imports.
const USED_VECTOR_ICON_FONTS = new Set([
  'Ionicons.ttf',      // src/app/(tabs)/_layout.tsx, TransactionHistoryScreen.tsx
  'Feather.ttf',       // src/app/(tabs)/index.tsx, AppInput.tsx, CategorySpendingCard.tsx, BudgetHealthCard.tsx
]);

const defaultResolver = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Check if this is a .ttf font from @expo/vector-icons
  if (
    typeof moduleName === 'string' &&
    moduleName.endsWith('.ttf') &&
    moduleName.includes('@expo/vector-icons')
  ) {
    const fontFileName = moduleName.split('/').pop();
    if (!USED_VECTOR_ICON_FONTS.has(fontFileName)) {
      // Return an empty module stub — font won't be bundled
      return { type: 'empty' };
    }
  }

  // Fall through to default resolver for everything else
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
