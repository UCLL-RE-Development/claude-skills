# Token source A — the host project's own code

Use this when the theme must look like **the app in this repository**. The goal is that someone who
clicks "Login" in the app does not feel they have left it. Do not invent a single value. Every value
is copied from the project.

## Where the tokens hide

Read these before writing any CSS:

| What | Where it usually hides |
| --- | --- |
| Colour + type tokens | `:root` in a global stylesheet, `tailwind.config.*` / `@theme` in Tailwind v4, SCSS `_variables`, a design-tokens JSON, a `theme.ts` (MUI, Chakra, styled-components) |
| Card / field / button shapes | the button, input and card **components**, not the global sheet |
| Fonts | a `fonts/` directory with its own `@font-face` CSS, a webfont `<link>` in `index.html`, `next/font`, `@fontsource/*` in `package.json` |
| Logo + favicon | `assets/`, `public/`, `static/`. Check what the app's own header **actually loads**, not what is lying around |
| Page ground | the `html, body` rule: a flat colour, a gradient or an image |
| Light vs dark | the app's default theme setting, and whether any UI offers a switch |

In a **RE-Frame** project it is `client/style/light.css` (tokens), `client/style/global.css` (card,
form-input, link, page gradient), `client/components/btn` and `client/components/card` (shapes),
`client/style/fonts/*` (font files plus `fonts.css`), `client/assets/` (marks), and `defaultTheme`
in `client/app.config.js`.

## Rules

1. **Quote the project's token name beside every value you copy:**
   `--p-canvas: #FAFCFF;   /* --neutral-10-color */`. This makes the two files diffable by eye,
   and it is the only thing that keeps them in step later. The token sheet's **Source** column gets
   the same name.
2. **When the project has two conventions, follow the one that is actually used.** A global
   `.form-input` rule and the inputs on the app's busiest form pages often disagree. The busy pages
   win: they are newer and they agree with each other. Say which one you picked and why.
3. **Follow the app's real usage, not its global rule, for fonts too.** For example, a display face
   applied globally to every `<a>` that the busiest surfaces override back is not the link font.
   A hand-drawn face on "Forgot password?" at 13px is the wrong trade in a form people read under
   pressure. Record the choice.
4. **Measure contrast before adopting a token** (`scripts/contrast.mjs`). App palettes are often
   fine at 14px body copy but fail at a 10px label or behind a 13px button label. Status colours
   pitched for a filled badge almost always fail as ink. Adjust the **minimum** number of tokens:
   keep the app's hue and saturation, darken until the token clears about 5:1 on the card, list
   each change in the deviations table, and keep the app's own value everywhere decorative.
5. **One family, only the weights used.** Ship the weights the theme actually uses (typically
   400/600/700). Every extra face is downloaded before the visitor has logged in. A 300 weight is
   too thin at a 10–11px label anyway.
6. **No italic if the family ships no italic face.** A synthesised oblique of a geometric sans
   reads as a rendering fault, not as emphasis.

## Embedding what you found

Follow [self-contained.md](self-contained.md). In short: **copy** the font files and the mark into
`<type>/resources/` and commit them. Never link to the app's `/fonts/…`, because Keycloak serves
from its own origin and the link would 404. If the app loads its font from Google Fonts or a CDN,
download the woff2 files once and embed them.

## What to ask the user

Ask only what you cannot read off the repo:

- the **realm name** and the **web client id** (the repo may name more than one; ask which one the
  browser reaches)
- which **Keycloak version** production runs
- whether the realm has **Organizations** enabled
- which **locales** the realm should serve

Everything visual comes from the code. If the repo genuinely has no token for something (no
focus style, no read-only field style), derive it from the palette, mark it `DERIVED` in the
Source column, and say so.
