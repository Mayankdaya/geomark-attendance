import nextAll from "eslint-config-next";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextAll,
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Experimental React-Compiler rules (next 16): misfire on intentional
      // clock-tick / polling patterns (Date.now in useState, fetch in effect).
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "download/**",
      "scripts/**",
      "skills/**",
      "db/**",
      "src/generated/**",
    ],
  },
];

export default config;
