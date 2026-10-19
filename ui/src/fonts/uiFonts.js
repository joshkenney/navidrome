// Typefaces that can replace the theme's font across the whole UI (Personal > Font). The files
// are served from public/fonts
export const DEFAULT_FONT = 'default'

const FALLBACK = 'system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif'

export const UI_FONTS = {
  // A public-domain revival of Susan Kare's Chicago, the font of the classic Mac and early iPods
  chicago: {
    name: 'Chicago',
    family: `"ChicagoFLF", ${FALLBACK}`,
    fontFace: `
      @font-face {
        font-family: 'ChicagoFLF';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('fonts/ChicagoFLF.ttf') format('truetype');
      }
    `,
  },
  // Close to the Myriad-based faces of later iPods (Podium Sans); SIL Open Font License
  podium: {
    name: 'Source Sans 3 (iPod mini/nano)',
    family: `"Source Sans 3", ${FALLBACK}`,
    fontFace: `
      @font-face {
        font-family: 'Source Sans 3';
        font-style: normal;
        font-weight: 200 900;
        font-display: swap;
        src: url('fonts/SourceSans3-Variable.woff2') format('woff2');
      }
    `,
  },
}

// The stylesheet that applies a font everywhere, overriding the theme's fonts. Code keeps its
// monospace font
export const uiFontStylesheet = (id) => {
  const font = UI_FONTS[id]
  if (!font) return ''
  return `${font.fontFace}
    body, body *:not(code):not(pre):not(kbd):not(samp) {
      font-family: ${font.family} !important;
    }
  `
}
