# Deploying the invitation to menaincet.com/yeabsrachristian

This repo auto-deploys to `https://menaincet.com/yeabsrachristian` whenever you push to `main`.

## One-time setup

### 1. Keep credentials in GitHub Actions secrets
The deploy workflow uses a cPanel API token stored as `CPANEL_TOKEN`.
Do not commit cPanel or GitHub tokens to the repo.

### 2. Create the GitHub repo and push
From this folder:
```bash
git init
git add .
git commit -m "Engagement invitation site"
git branch -M main
git remote add origin https://github.com/<you>/yeabsra-christian-engagement.git
git push -u origin main
```
(Create the empty `yeabsra-christian-engagement` repo on github.com first, or use `gh repo create`.)

### 3. Add the deploy secret in GitHub
Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret name    | Value                                    |
|----------------|------------------------------------------|
| `CPANEL_TOKEN` | your cPanel API token                    |
| `DB_NAME`      | the gallery database name                |
| `DB_USER`      | the gallery database user                |
| `DB_PASS`      | the gallery database password            |
| `ADMIN_KEY`    | the gallery admin passcode               |

Credentials live only in GitHub's encrypted secrets.

### 4. Push again (or run the workflow manually)
Any push to `main` now uploads the site into `/home/menainpy/public_html/yeabsrachristian/`.
First run also creates that directory, its `assets`, `api`, and `admin` folders.

## Notes
- The site uses relative paths, so it works fine under the `/yeabsrachristian` subpath.
- Fonts (Google Fonts) and the background music (YouTube) load from the internet.
- `.github/workflows/deploy.yml` controls the deploy; `EXCLUDE` keeps repo-only
  files (README, the `.dc.html` source, uploads, etc.) off the live server.
