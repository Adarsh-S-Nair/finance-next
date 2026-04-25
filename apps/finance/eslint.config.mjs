import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      // This app intentionally bridges async sources (Supabase auth,
      // react-query cache hydration, modal lifecycles, timers) into local
      // state from effects. The React Compiler advisory is too broad for
      // those existing patterns, so keep CI focused on correctness rules.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      // Most image tags here are tiny institution, merchant, and avatar
      // assets from arbitrary provider domains. Next/Image would require a
      // broad remote allowlist or per-source config without meaningful LCP
      // benefit for these UI icons.
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
