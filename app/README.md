# LifePark app

LifePark is part of the CoheGen / CoheGen Studio suite. The suite launches it
from `https://cohegen.net/lifepark/`; sign-in and signed-in screens link back to
`https://cohegen.net/studio/#projects`.

Its intended custom domain is `lifepark.cohegen.net`, on its existing Vercel
project. Until setup is complete, the suite uses the verified public alias
`https://life-park-app.vercel.app/`. The production trusted-origin list includes
the exact CoheGen subdomain and retains the existing aliases.

After HTTPS works, register the new Google/Apple callback URLs and set production
`BETTER_AUTH_URL=https://lifepark.cohegen.net`. Keep the current database and
sign-in secret. Cookies and passkeys belong to a hostname: people will sign in
again, and passkeys registered on the old hostname must be registered again on
the new one after signing in by password or Google. Keep the old aliases working
during the change. Do not change the passkey relying-party domain globally to
`cohegen.net`; it must match LifePark's own sign-in hostname.

The web app described in [../docs/SPEC.md](../docs/SPEC.md), built in the order of [../docs/PLAN.md](../docs/PLAN.md).

## Commands

```bash
pnpm install
pnpm dev        # local development server
pnpm lint       # code style checks
pnpm typecheck  # type checks
pnpm test       # unit tests
pnpm build      # production build
```

## Hosting

Deployed on Vercel. The Vercel project's root directory must be set to `app`, because the repository root holds Anthony's agent toolkit rather than the app.

## Structure

- `src/app`: routes, layout, global styles, app manifest and icon.
- `src/components`: shared interface pieces.

Design tokens live in `src/app/globals.css` and follow the "Paper stamp" direction in the spec.
