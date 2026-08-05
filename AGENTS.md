<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Regras de UI/UX

- Todas as datas exibidas na UI devem usar o formato **DD-MM-YYYY** (ex.: `31-12-2026`). Usar sempre `formatDate` de `lib/format.ts`; nunca renderizar data crua (`YYYY-MM-DD`) direto no JSX.
- Datas com o separador `/` (DD/MM/YYYY) são proibidas na UI.
