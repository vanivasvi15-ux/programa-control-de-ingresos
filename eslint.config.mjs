import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Patrón normal en este panel: al montar una pantalla se hace un
      // fetch y se guarda el resultado en estado, o se lee localStorage y
      // se hidrata el estado. Esta regla (nueva y muy estricta) lo marca
      // como error; acá es a propósito y controlado.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts sueltos de línea de comandos (Node puro con require()), se
    // corren con `node scripts/...`, no son parte del bundle de la app.
    "scripts/**",
    // El bot de WhatsApp es un proyecto Node aparte, con su propio
    // package.json y dependencias.
    "bot-whatsapp/**",
  ]),
]);

export default eslintConfig;
