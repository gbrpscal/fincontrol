// Config única para o monorepo inteiro — ESLint (flat config) resolve este
// arquivo subindo a árvore de diretórios a partir de onde o comando roda,
// então `pnpm --filter <pkg> run lint` (executado dentro de cada pacote)
// já enxerga esta config sem precisar duplicá-la em cada package.json.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.expo/**",
      "**/node_modules/**",
      "**/coverage/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
