module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Required by PowerSync's watched queries, which expose results as
    // async iterators. Without this, watched queries fail at runtime.
    plugins: ['@babel/plugin-transform-async-generator-functions'],
  };
};
