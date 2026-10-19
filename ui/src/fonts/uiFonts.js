// Typefaces that can replace the theme's font across the whole UI (Personal > Font). The files
// are served from public/fonts
export const DEFAULT_FONT = 'default'

const FALLBACK = 'system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif'

// A public-domain revival of Susan Kare's Chicago, the font of the classic Mac and early iPods
const CHICAGO = {
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
}

// Close to the Myriad-based faces of later iPods (Podium Sans); SIL Open Font License
const SOURCE_SANS = {
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
}

// Short labels and headings, where the iPod and the classic Mac used Chicago
const HEADINGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  '.MuiTypography-h1',
  '.MuiTypography-h2',
  '.MuiTypography-h3',
  '.MuiTypography-h4',
  '.MuiTypography-h5',
  '.MuiTypography-h6',
  '.MuiDialogTitle-root',
  '.MuiAppBar-root .MuiToolbar-root > .MuiTypography-root',
  '.MuiDrawer-root .MuiMenuItem-root',
  '.MuiDrawer-root .MuiListItem-button',
  '.MuiTab-root',
  '.MuiButton-label',
  '.MuiTableCell-head',
  '.MuiListSubheader-root',
  // The iPod selector at the top of the sidebar
  '.MuiDrawer-root .MuiChip-label',
  // The player's song title, artist and album
  '.songTitle',
  '.songDetails',
]

// Text styled as a heading that is really body text, like album comments: it keeps the body font.
// The class is doubled to outweigh the headings rule
export const BODY_TEXT_CLASS = 'ndBodyText'
const BODY_TEXT = `.${BODY_TEXT_CLASS}.${BODY_TEXT_CLASS}`

export const UI_FONTS = {
  // Chicago for headings and labels, Source Sans 3 for everything else (lists, details, numbers)
  ipod: {
    name: 'iPod (Chicago + Source Sans 3)',
    body: SOURCE_SANS,
    headings: CHICAGO,
  },
  chicago: { name: 'Chicago', body: CHICAGO },
  podium: { name: 'Source Sans 3 (iPod mini/nano)', body: SOURCE_SANS },
}

// The stylesheet that applies a font everywhere, overriding the theme's fonts. Code keeps its
// monospace font. The body rule has no specificity (:where), so the headings rule always wins
export const uiFontStylesheet = (id) => {
  const font = UI_FONTS[id]
  if (!font) return ''
  const faces = [font.body, font.headings].filter(Boolean)
  let css = `${faces.map((f) => f.fontFace).join('')}
    :where(body, body *:not(code, pre, kbd, samp)) {
      font-family: ${font.body.family} !important;
    }
  `
  if (font.headings) {
    const selectors = HEADINGS.flatMap((s) => [s, `${s} *`]).join(', ')
    // Chicago has a single weight: a faked bold would smear it
    css += `
    ${selectors} {
      font-family: ${font.headings.family} !important;
      font-synthesis: none;
      letter-spacing: 0.02em;
    }
    ${BODY_TEXT}, ${BODY_TEXT} * {
      font-family: ${font.body.family} !important;
      letter-spacing: normal;
    }
  `
  }
  return css
}
