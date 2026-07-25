# Product

## Register

product

## Users

University students, IIT campuses first, other institutes added over time. They
arrive from a link someone sent them, on a phone as often as a laptop, and they
want one thing: to get into the group chat. They are technically literate and
suspicious of forms that ask for more than they need. Total time on this site
should be under a minute, split across two screens.

## Product Purpose

A door. It proves you hold an email address at an approved institute, then hands
you a time-limited, browser-bound redirect to a private Signal group. It stores
nothing: no database, no accounts, no email addresses in logs. Success is a
student getting through without thinking about the site, and an outsider getting
nowhere.

## Brand Personality

Precise, quiet, unbranded. It reads as infrastructure rather than a product with
opinions. Copy is plain and specific; no welcome message, no exclamation marks,
no reassurance theatre beyond the one line that states what is and isn't stored.

## Anti-references

- Generated-looking landing pages: ambient glow blobs, breathing gradients,
  gradient-filled buttons, a pulsing dot next to every status word.
- Consumer-app onboarding warmth: illustrations, rounded blobs, encouragement.
- Retro-hacker cosplay: phosphor green, scanlines, ASCII borders.
- Enterprise SSO screens: dense chrome, logos, legal text.

Reference point is the Render dashboard: near-black, hairline borders, one
accent used only for the primary action and focus.

## Design Principles

1. **The page is a hallway, not a room.** Nothing to explore, one thing to do.
   No card, no panel chrome, no secondary calls to action.
2. **Say what happens to the data.** The "stores nothing" claim is the only
   persuasion on the page, so it is stated once, plainly, and it is literally true.
3. **Progressive disclosure over completeness.** The approved-institute list will
   grow past what fits on a phone screen. It ships collapsed from day one.
4. **No JavaScript, and it shouldn't show.** The CSP blocks all scripts. Every
   interaction is a real form or a native `<details>`. The constraint should read
   as restraint, not as limitation.
5. **Legible on a phone in sunlight.** Body text clears 4.5:1, the code field is
   large and monospaced, tap targets are full-width.

## Accessibility & Inclusion

WCAG 2.2 AA. Visible focus rings on every interactive element (never
`outline: none` without a replacement). Errors announced via `role="alert"` and
never conveyed by color alone. Full `prefers-reduced-motion` path. Dark-only is
a deliberate choice, not an omission: the palette is tuned for it and contrast is
verified against the dark surfaces.
