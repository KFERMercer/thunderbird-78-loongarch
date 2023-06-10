"use strict";

const xpcshellTestConfig = require("eslint-plugin-mozilla/lib/configs/xpcshell-test.js");
const browserTestConfig = require("eslint-plugin-mozilla/lib/configs/browser-test.js");

/**
 * Some configurations have overrides, which can't be specified within overrides,
 * so we need to remove them.
 */
function removeOverrides(config) {
  config = { ...config };
  delete config.overrides;
  return config;
}

const xpcshellTestPaths = [
  "**/test*/unit*/",
  "**/test*/xpcshell/",
  "chat/**/test*/",
];

const browserTestPaths = ["**/test*/**/browser/"];

module.exports = {
  parser: "babel-eslint",
  parserOptions: {
    sourceType: "script",
    babelOptions: {
      plugins: [
        "@babel/plugin-syntax-optional-chaining",
        "@babel/plugin-syntax-nullish-coalescing-operator",
      ],
    },
  },

  root: true,

  // We would like the same base rules as provided by
  // mozilla/tools/lint/eslint/eslint-plugin-mozilla/lib/configs/recommended.js
  extends: ["plugin:mozilla/recommended"],

  // When adding items to this file please check for effects on sub-directories.
  plugins: ["mozilla"],

  rules: {
    complexity: ["error", 80],
    "func-names": ["error", "never"],
    "mozilla/prefer-boolean-length-check": "off",
  },

  // To avoid bad interactions of the html plugin with the xml preprocessor in
  // eslint-plugin-mozilla, we turn off processing of the html plugin for .xml
  // files.
  settings: {
    "html/xml-extensions": [".xhtml"],
  },

  overrides: [
    {
      files: "**/.eslintrc.js",
      env: {
        node: true,
      },
    },
    {
      ...removeOverrides(xpcshellTestConfig),
      files: xpcshellTestPaths.map(path => `${path}**`),
      rules: {
        ...xpcshellTestConfig.rules,
        "func-names": "off",
      },
    },
    {
      // If it is a test head file, we turn off global unused variable checks, as it
      // would require searching the other test files to know if they are used or not.
      // This would be expensive and slow, and it isn't worth it for head files.
      // We could get developers to declare as exported, but that doesn't seem worth it.
      files: [
        ...browserTestPaths.map(path => `${path}head*.js`),
        ...xpcshellTestPaths.map(path => `${path}head*.js`),
      ],
      rules: {
        "no-unused-vars": [
          "error",
          {
            args: "none",
            vars: "local",
          },
        ],
      },
    },
    {
      ...browserTestConfig,
      files: browserTestPaths.map(path => `${path}**`),
      rules: {
        ...browserTestConfig.rules,
        "func-names": "off",
      },
    },
  ],
};
