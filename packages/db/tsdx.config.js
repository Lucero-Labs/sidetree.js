// Not transpiled with TypeScript or Babel, so use plain Es6/Node.js!
const replace = require("@rollup/plugin-replace");

module.exports = {
  rollup(config, opts) {
    // Find and modify the TypeScript plugin
    const tsPlugin = config.plugins.find(p => p && p.name === 'rpt2');
    if (tsPlugin && tsPlugin.options) {
      tsPlugin.options.abortOnError = false;
    }

    config.plugins = config.plugins.map((p) =>
      p.name === "replace"
        ? replace({
            "process.env.NODE_ENV": JSON.stringify(opts.env),
            preventAssignment: true,
          })
        : p
    );
    return config;
  },
};