const base = require('./app.json');

module.exports = () => {
  const isDemo = process.env.EXPO_PUBLIC_APP_VARIANT === 'demo';

  return {
    ...base.expo,
    name: isDemo ? 'KOTY Demo' : base.expo.name,
    android: {
      ...base.expo.android,
      package: isDemo ? 'pl.dom.kociposilek.demo' : base.expo.android.package,
    },
    ios: {
      ...base.expo.ios,
      bundleIdentifier: isDemo ? 'pl.dom.kociposilek.demo' : base.expo.ios.bundleIdentifier,
    },
  };
};
