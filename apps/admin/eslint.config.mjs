import nextConfig from "eslint-config-next";

// Mirrors apps/finance/eslint.config.mjs — both apps share the same React 19
// rule overrides. The React Compiler advisory `set-state-in-effect` rule
// false-positives on legit mount-sync patterns (theme provider reading from
// the DOM after mount, portal-mount guards, etc), so it's off here too.
// Keep these two configs in sync; if a third app appears we'll extract to
// packages/config.
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
