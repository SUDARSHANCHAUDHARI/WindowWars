# Deployment

WindowWars deploys as static files and requires no server-side runtime.

## Build and verify

```bash
pnpm verify
```

This runs syntax checks, all automated tests, and creates `dist/`. Deploy the contents of `dist/`, not the source repository.

Preview the exact artifact locally with `pnpm start`, then open `http://localhost:4174`.

## Static host settings

- Build command: `pnpm build`
- Output directory: `dist`
- Node.js: 20 or newer
- Environment variables: none

The artifact includes `_headers` for hosts that support the Netlify/Cloudflare Pages header format. On other hosts, configure the same policies in the provider dashboard. The most important policies are Content Security Policy, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and clickjacking protection.

## Pre-release checklist

1. Run `pnpm verify` from a clean checkout.
2. Confirm `dist/` contains ten files and no source tests or repository metadata.
3. Serve `dist/` locally and test pointer, touch, keyboard, sound, reset, attempt ten, and reduced-motion behavior.
4. Set the final production URL, then add a canonical URL and sitemap if search indexing is wanted.
5. Verify the deployed response headers using the hosting provider or an HTTP header checker.
6. Keep the GitHub repository private until Sudarshan explicitly approves a visibility change.

## Rollback

Static deployments are immutable. Roll back by redeploying the previous known-good `dist/` artifact or selecting the previous deployment in the hosting provider. The game stores no user data, so rollback has no migration or data-loss risk.
