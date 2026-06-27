# Artistic Pixel Art

Converte imagens em pixel art diretamente no browser, sem backend.

## Stack

- **React 19** + **TypeScript**
- **Vite** — bundler e dev server
- **Tailwind CSS v4** + shadcn/ui
- **Canvas API** — processamento de imagem client-side
- **Lospec API** — paletas de cores comunitárias

## Funcionalidades

- Upload de imagens (drag & drop ou seleção)
- Controle de tamanho de bloco, tamanho de paleta, contraste e brilho
- Dithering ordenado (Bayer) para gradientes mais suaves
- Quantização de cores perceptual (median-cut em espaço Lab)
- Presets de estilo (8-bit Classic, 16-bit Sharp, Mosaic, etc.)
- Paletas built-in, importação via Lospec slug ou hex customizado
- Comparação antes/depois com slider e download do resultado em PNG

## Desenvolvimento

```bash
# Instalar dependências
pnpm install

# Iniciar dev server (porta 5173 por padrão)
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/pixel-art dev

# Build de produção
pnpm --filter @workspace/pixel-art build
```

## Requisitos

- Node.js 20+
- pnpm 9+
