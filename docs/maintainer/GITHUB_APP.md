# Setting up LifePark's GitHub App

LifePark reads people's repositories through a GitHub App it owns. The code is
built and tested; the app itself has to be registered once, in Anthony's GitHub
account, and its four values put in Vercel. Until then the Workshop lawn shows a
sign and Settings says GitHub isn't set up.

## Settings to use

| Field | Value |
| --- | --- |
| GitHub App name | LifePark (if taken: LifePark Park) |
| Homepage URL | https://work-park.vercel.app |
| Callback URL | https://work-park.vercel.app/api/github/callback |
| Expire user authorization tokens | On (the default) |
| Request user authorization (OAuth) during installation | **Off** |
| Enable Device Flow | Off |
| Setup URL | https://work-park.vercel.app/api/github/connect |
| Redirect on update | **On** |
| Webhook → Active | **Off** (LifePark doesn't use webhooks) |
| Repository permissions | Metadata: Read-only (nothing else) |
| Organization and account permissions | none |
| Where can this GitHub App be installed? | Any account |

Then, on the app's page after creating it:

1. Note the app's short name from its public address, `github.com/apps/<slug>`.
2. Copy the **Client ID**.
3. **Generate a new client secret** and copy it.
4. **Generate a private key**; a `.pem` file downloads.

## Vercel environment variables (Production and Preview)

- `GITHUB_APP_SLUG`: the short name from step 1
- `GITHUB_APP_CLIENT_ID`: from step 2
- `GITHUB_APP_CLIENT_SECRET`: from step 3
- `GITHUB_APP_PRIVATE_KEY`: the entire contents of the `.pem` file, including the BEGIN and END lines

Redeploy afterwards. Then open Settings → GitHub → Connect GitHub to check it.

## Prompt for a browser agent

> Using my signed-in Chrome, create a GitHub App for my web app LifePark and wire it into Vercel. Do not show me or paste any secret into this chat; paste secrets only into the Vercel fields named below.
>
> 1. Go to https://github.com/settings/apps/new. Fill in: GitHub App name "LifePark" (if taken, "LifePark Park"); Homepage URL https://work-park.vercel.app; Callback URL https://work-park.vercel.app/api/github/callback; leave "Expire user authorization tokens" checked; leave "Request user authorization (OAuth) during installation" unchecked; leave "Enable Device Flow" unchecked; Setup URL https://work-park.vercel.app/api/github/connect and check "Redirect on update"; under Webhook uncheck "Active". Under Permissions → Repository permissions set only "Metadata" to "Read-only"; leave every other permission at "No access". Under "Where can this GitHub App be installed?" choose "Any account". Click Create GitHub App.
> 2. On the app's page, note the app's public address github.com/apps/<slug> (the slug is the last part), copy the Client ID, click "Generate a new client secret" and copy it, then under Private keys click "Generate a private key" (a .pem file downloads; open it in a text editor and copy its whole contents, including the BEGIN and END lines).
> 3. Go to https://vercel.com, open my project for work-park.vercel.app → Settings → Environment Variables. Add these four, each for Production and Preview: GITHUB_APP_SLUG = the slug; GITHUB_APP_CLIENT_ID = the Client ID; GITHUB_APP_CLIENT_SECRET = the client secret; GITHUB_APP_PRIVATE_KEY = the whole .pem contents. Save.
> 4. Go to the project's Deployments, open the latest Production deployment's menu, and click Redeploy. Wait until it says Ready.
> 5. Tell me the app's name and slug, and confirm each of the four variables exists in Vercel (names only, never values), and that the redeploy is Ready. Then delete the downloaded .pem file.
