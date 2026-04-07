import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["engine/", "src/lib/backtestTradingEngine.js"],
  },
  {
    rules: {
      // React 19 strict rules — downgrade to warnings until code is refactored
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
