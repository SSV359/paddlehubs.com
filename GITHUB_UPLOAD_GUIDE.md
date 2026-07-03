# GitHub Upload Guide — Keeping PaddleHubs Safe to Make Public

Step-by-step for getting this project onto GitHub (or updating your
existing repo) without leaking anything sensitive. Read section 1 first
even if you're in a hurry — it's the part that can't be undone by editing
files after the fact.

## 1. Before you touch git: what's actually sensitive here

I audited the repo. Here's the honest breakdown:

| File | Risk | What I did |
|---|---|---|
| `.env` | Contains your Cognito domain, client ID, redirect URIs, API base URL. Not a secret credential (it's a public OAuth client, no client secret), but still config that shouldn't be public and **was not previously gitignored**. | Added to `.gitignore`. Created `.env.example` with placeholder values for anyone setting up the project. |
| `players_keys.json` | Raw DynamoDB export containing real Cognito user IDs (`userSub` values). No reason to be in version control. | Added to `.gitignore`. |
| `PaddleHubs_Phase_1_Completion_Document_v4.pdf` | I extracted and read the text — it's a general architecture write-up with no credentials, account IDs, or secrets. **Safe**, but outdated (Phase 1 only). Your call whether to keep, update, or remove it. | Left as-is. |
| `lambda_index.mjs`, `backfillPlayers.js` | Checked for hardcoded AWS account IDs, ARNs, or pool IDs — none found. Everything sensitive is read from environment variables at runtime, not hardcoded. | Safe to publish as-is. |
| `package-lock.json`, source code, configs | No secrets found anywhere. | Safe. |

**Nothing in your actual Lambda's environment variables (User Pool ID,
AWS account ID, API URLs) lives inside any file in this repo** — those
only exist in the AWS console / Lambda configuration, which is exactly
where they should stay.

## 2. Critical: check whether secrets were already pushed to GitHub

Your repo already exists on GitHub with commit history from before this
`.gitignore` fix. **Adding a file to `.gitignore` today does nothing to
remove it from commits that already happened.** If `.env` or
`players_keys.json` were ever committed in the past, they're still
sitting in your GitHub history right now, even if the current file tree
looks clean.

Check this before doing anything else:

```bash
git log --all --full-history -- .env
git log --all --full-history -- players_keys.json
```

**If either command prints nothing** — good, they were never committed.
Skip to section 3.

**If either command shows commits** — those files are in your history.
Since your `.env` doesn't contain an actual secret (no Cognito client
secret, just a public client ID), this is lower-severity than a real key
leak, but it's still worth cleaning up properly, especially for
`players_keys.json` since it contains real user identifiers:

```bash
# Option A — git filter-repo (recommended, fast, actively maintained)
pip install git-filter-repo --break-system-packages
git filter-repo --path .env --path players_keys.json --invert-paths

# Option B — BFG Repo-Cleaner (Java-based alternative)
# Download from https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files .env
java -jar bfg.jar --delete-files players_keys.json
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

Either option rewrites history — after running one:

```bash
git push origin --force --all
git push origin --force --tags
```

**This changes commit hashes.** Anyone else with a local clone needs to
re-clone fresh rather than pull. If this is a solo project, that's not a
practical concern — just know it happened.

## 3. First-time git setup (skip if the repo is already cloned locally)

```bash
git clone https://github.com/SSV359/paddlehubs.com.git
cd paddlehubs.com
```

## 4. Confirm the working tree is actually clean before committing

```bash
git status
```

`.env` and `players_keys.json` should **not** appear in the output at
all (not even as "untracked"). If they do appear as untracked, that's
fine — untracked + gitignored means git is correctly ignoring them. If
they appear as "Changes to be committed" or already tracked, something's
wrong — stop and re-check your `.gitignore` before proceeding.

Double check gitignore is actually catching them:

```bash
git check-ignore -v .env
git check-ignore -v players_keys.json
```

Both should print a match. If a command prints nothing, that file is
**not** being ignored — fix `.gitignore` before committing anything.

## 5. Stage, commit, and push

```bash
git add .
git status   # review the file list one more time before committing
git commit -m "Add gitignore rules for env/secrets, add .env.example"
git push origin main
```

## 6. Ongoing hygiene (set these up once, they protect you going forward)

**Enable GitHub's built-in secret scanning** (free for public repos):
Repo → Settings → Code security and analysis → enable "Secret scanning"
and "Push protection". This blocks pushes that contain known secret
patterns (AWS keys, API tokens, etc.) before they ever reach GitHub.

**Add a pre-commit secret scanner locally** (catches things before they
even leave your machine):

```bash
pip install detect-secrets --break-system-packages
detect-secrets scan > .secrets.baseline
```

Or use [gitleaks](https://github.com/gitleaks/gitleaks) as a pre-commit
hook — either works, pick one you'll actually keep enabled.

**Never commit real values to `.env.example`.** It exists specifically
so contributors know *which* variables are needed without seeing your
actual values — keep it that way permanently.

## 7. Final checklist before flipping the repo to public

- [ ] `git log --all --full-history -- .env` and `-- players_keys.json` both return nothing
- [ ] `.gitignore` includes `.env`, `.env.*`, and `players_keys.json`
- [ ] `.env.example` exists with placeholder values only
- [ ] `git status` shows a clean tree with no sensitive files staged
- [ ] GitHub secret scanning + push protection enabled (Settings → Code security and analysis)
- [ ] README.md doesn't reference internal AWS account IDs, ARNs, or User Pool IDs (checked — it doesn't)
- [ ] Double-checked `PaddleHubs_Phase_1_Completion_Document_v4.pdf` if you've added any new internal documents since — re-check any *new* PDFs/docs the same way before adding them
