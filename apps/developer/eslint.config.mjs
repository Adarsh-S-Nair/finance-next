import nextConfig from "eslint-config-next";

// Mirrors apps/admin and apps/finance — keep these three configs in sync.
const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
