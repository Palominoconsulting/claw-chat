# Design decisions

Approved direction: `.impeccable.md`.

## Accepted tokens
- Editorial lobster scarlet, warm shell paper and ink/oxblood dark surfaces; perceptual OKLCH tokens.
- Fraunces for the wordmark/editorial headlines; Instrument Sans for compact workbench UI. Bundled font files only.
- Default light theme with persistent dark option. No forced animation.
- Photography in welcome/setup; original small letterform mascot in active transcripts. No photographs behind evidence.
- Desktop three-pane workbench. Mobile uses a navigation drawer and full-width inspector instead of squeezed columns.
- Brand scarlet is separate from operational warning plum/amber. Errors always carry icon/text, never color alone.

## Anti-patterns
No dashboard KPI grid, glassmorphism, glowing gradients, decorative charts, streaming fake inference, model-generated praise, automatic approval, or praise during errors/review.

## Primitives and provenance
`src/components/Primitives.tsx` is original MIT source, uses React Aria's Apache-2.0 Button, and includes original geometric SVG icons. No Untitled UI PRO source/components copied. Parent-supplied lobster images have their own provenance document under public/assets.

## Shipped review surfaces
Welcome, chat/excerpt preview, stage packet preview, revision checkpoint, context/export preview and connection boundary are implemented in this branch. They remain subject to independent review and a human smoke test.
