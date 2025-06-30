import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";

export default [
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    ignores: ["dist/**", "gemini-cli/**"], // Ignore the dist and gemini-cli directories
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node, // Add Node.js globals
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: "module",
      },
    },
    rules: {
      // Disable no-explicit-any for now due to extensive usage
      "@typescript-eslint/no-explicit-any": "off",
      // Allow unused variables that start with an underscore
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      // Disable prop-types as it's a TypeScript project
      "react/prop-types": "off",
      // Disable react-in-jsx-scope for new JSX transform
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // Allow require() in Node.js files (e.g., tailwind.config.js, scripts)
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off", // Temporarily disable no-undef to avoid conflicts with process/require
      "no-useless-escape": "error", // Enable unnecessary escape character rule for source files
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReactConfig,
  {
    files: ["src/**/*.{ts,tsx}"], // Apply React rules only to src directory
    rules: {
      'react/react-in-jsx-scope': 'error',
      'react/jsx-uses-react': 'error',
    },
    settings: {
      react: {
        version: "detect", // Automatically detect React version
      },
    },
  },
  {
    files: ["**/*.js"], // Apply to .js files, especially in scripts/ and config files
    rules: {
      "no-undef": "off", // Allow process, require etc. in JS files
    },
  },
];