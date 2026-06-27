# Artistic Pixel Art

Converte imagens em pixel art diretamente no browser, sem backend.

**▶ Demo ao vivo: https://avandocampos.github.io/pixel-art/**

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

## Como funciona

Todo o processamento roda no cliente, sobre um `<canvas>`:

1. **Blocos** — a imagem é dividida em blocos de `N×N` pixels e cada bloco vira uma cor média.
2. **Paleta** — gerada por median-cut em espaço Lab (perceptual) ou fornecida pela Lospec / hex customizado.
3. **Quantização** — cada bloco é mapeado para a cor de paleta mais próxima (distância em Lab), com dithering Bayer opcional.

O núcleo do algoritmo está em [`src/lib/pixelArt.ts`](artifacts/pixel-art/src/lib/pixelArt.ts).

## Desenvolvimento

```bash
# Instalar dependências
pnpm install

# Iniciar dev server (porta 5173 por padrão)
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/pixel-art dev

# Build de produção
pnpm --filter @workspace/pixel-art build
```

## Deploy

O push para `main` dispara o workflow [`deploy.yml`](.github/workflows/deploy.yml), que builda o app e publica no GitHub Pages automaticamente.

## Requisitos

- Node.js 20.19+ (recomendado 22+)
- pnpm 9+
