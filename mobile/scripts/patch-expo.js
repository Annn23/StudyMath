const fs = require('fs');
const path = require('path');

// 1. Patch ws-tunnel for Expo Tunnel
const wsPath = path.resolve('node_modules/@expo/ws-tunnel/build/index.js');
if (fs.existsSync(wsPath)) {
  let c = fs.readFileSync(wsPath, 'utf8');
  if (c.includes('new s.WebSocket(e,')) {
    c = c.replace('new s.WebSocket(e,', 'new (s.WebSocket||s)(e,');
    fs.writeFileSync(wsPath, c);
    console.log('[patch-expo] Patched ws-tunnel');
  }
}

// 2. Patch expo-notifications TopicSubscriptionModule for Expo Go
const topicPath = path.resolve('node_modules/expo-notifications/build/TopicSubscriptionModule.android.js');
if (fs.existsSync(topicPath)) {
  let c = fs.readFileSync(topicPath, 'utf8');
  if (c.includes("requireNativeModule('ExpoTopicSubscriptionModule')")) {
    c = `import { requireOptionalNativeModule } from 'expo';\nimport fallback from './TopicSubscriptionModule';\nexport default requireOptionalNativeModule('ExpoTopicSubscriptionModule') || fallback;\n`;
    fs.writeFileSync(topicPath, c);
    console.log('[patch-expo] Patched TopicSubscriptionModule');
  }
}

// 3. Patch expo-notifications ServerRegistrationModule for Expo Go
const serverRegPath = path.resolve('node_modules/expo-notifications/build/ServerRegistrationModule.native.js');
if (fs.existsSync(serverRegPath)) {
  let c = fs.readFileSync(serverRegPath, 'utf8');
  if (c.includes("requireNativeModule('NotificationsServerRegistrationModule')")) {
    c = `import { requireOptionalNativeModule } from 'expo';\nimport fallback from './ServerRegistrationModule';\nexport default requireOptionalNativeModule('NotificationsServerRegistrationModule') || fallback;\n`;
    fs.writeFileSync(serverRegPath, c);
    console.log('[patch-expo] Patched ServerRegistrationModule');
  }
}

// 4. Patch expo-router useScreens for defensive fallback
const useScreensPath = path.resolve('node_modules/expo-router/build/useScreens.js');
if (fs.existsSync(useScreensPath)) {
  let c = fs.readFileSync(useScreensPath, 'utf8');
  let modified = false;
  if (c.includes('function fromImport(value, { ErrorBoundary, SuspenseFallback')) {
    c = c.replace(
      'function fromImport(value, { ErrorBoundary, SuspenseFallback, unstable_settings, ...component }) {',
      'function fromImport(value, raw = {}) {\n    raw = raw || {};\n    const { ErrorBoundary, SuspenseFallback, unstable_settings, ...component } = raw;'
    );
    modified = true;
  }
  if (c.includes('ScreenComponent = result.default;\n        LayoutSuspenseFallback')) {
    c = c.replace(
      'ScreenComponent = result.default;\n        LayoutSuspenseFallback',
      'ScreenComponent = result.default || _EmptyRoute.EmptyRoute;\n        LayoutSuspenseFallback'
    );
    modified = true;
  }
  if (modified) {
    fs.writeFileSync(useScreensPath, c);
    console.log('[patch-expo] Patched expo-router useScreens');
  }
}

console.log('[patch-expo] All Expo patches verified.');
