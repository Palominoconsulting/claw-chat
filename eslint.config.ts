import antfu from "@antfu/eslint-config";
export default antfu({
  react: true,
  typescript: true,
  stylistic: false,
  ignores: ["dist/**", "public/**"],
  rules: {
    "antfu/top-level-function": "off",
    "node/prefer-global/process": "off",
    "node/prefer-global/buffer": "off",
    "perfectionist/sort-imports": "off",
    "perfectionist/sort-named-imports": "off",
    "react-dom/no-missing-button-type": "off",
  },
});
