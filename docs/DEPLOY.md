# SkyStunt.io — Deploy and temporary-link instructions

Status as of 2026-10-16: **no public deployment that lasts several days exists yet.** The two links that work are tied to this sandbox. Steps below are reproducible on any machine with Node 22 and an SSH client.

## 1. Run locally (verified)

```bash
npm install --legacy-peer-deps
npx vite build
PORT=8080 HOST=0.0.0.0 node server/index.js
# open http://localhost:8080 ; health: http://localhost:8080/healthz
```

## 2. Temporary public link (verified in this sandbox)

```bash
scripts/temp-public-link.sh localhost.run     # prints https://<id>.lhr.life
# or
scripts/temp-public-link.sh cloudflare        # needs cloudflared; prints https://<random>.trycloudflare.com
```

Checks after the link prints:

```bash
curl -s https://<link>/healthz                # expect {"ok":true,...}
node tests/browser/smoke.mjs https://<link>/  # expect title, WebGL 2, 0 errors
```

Limits (see `HOSTING_SURVEY.md`):
- The link ends when the tunnel or the machine stops. A sandbox restart kills it.
- The Cloudflare URL changes on every restart. The localhost.run URL changes too.
- Serveo, localtunnel, Pinggy free, and tunl.gg were tested and do not work for browser play.

## 2b. Static public drop (verified: ship.page / ship.place, no account)

`dist/` runs with no server: the client falls back to offline solo vs AI. Package and deploy:

```bash
npx vite build
(cd dist && zip -qr ../deploy/skystunt-static.zip .)
curl -X POST https://ship.page/deploy -H "Content-Type: application/zip" --data-binary @deploy/skystunt-static.zip
```

The response gives a URL (https://<slug>.ship.place/) and an expiry. The live drop is https://modest-shirt-zza26.ship.place/ (expires 2026-11-15). Opening the `claim_url` in the response saves it to a free account for 90 days. The claim link is private (`deploy/CLAIM-PRIVATE.txt`).

## 3. Docker image (not built here: Docker is not installed in this sandbox)

```bash
docker build -t skystunt .
docker run -p 8080:8080 skystunt
curl -s http://localhost:8080/healthz
```

The `Dockerfile` builds `dist/` in one stage and runs `server/index.js` as the `node` user in the second stage. `.dockerignore` keeps `node_modules`, `tests`, `scratch`, and `docs` out of the image.

## 4. Several-day hosting on Northflank (status: API key verified, service not yet created)

Verified:
- The API token works. It can see one project, `default`, which has no services yet (`GET /v1/projects/default/services`).
- Northflank's API docs say a public GitHub repo can be built without linking a Git account. Only private repos need that link.

Not verified: the free Sandbox CPU and memory limits (F08 says only "always-on, 2 free services"). The script uses `nf-compute-20` (0.2 shared vCPU, 512 MB, list price $5.40/mo) and a build plan `nf-compute-200-8`. Check both in the dashboard before relying on them.

Steps:
1. Put the project in a **public** GitHub repo: `git remote add origin https://github.com/<you>/skystunt.git && git push -u origin main`. The repo already has one local commit (`main`).
2. Dry run: `NF_REPO_URL=https://github.com/<you>/skystunt NF_PROJECT_ID=default node scripts/northflank-deploy.mjs`. Check the payload.
3. Create the service: `NORTHFLANK_API_TOKEN=... NF_PROJECT_ID=default NF_REPO_URL=https://github.com/<you>/skystunt node scripts/northflank-deploy.mjs --apply`. This creates a combined service that builds the `Dockerfile` on Northflank and deploys it. The response includes the service ID.
4. Wait for the build, then check the public URL: `curl https://<url>/healthz`, then `node tests/browser/smoke.mjs https://<url>/`.
5. Revoke the API token in Northflank settings once the deploy is verified. It was pasted into a chat.

Unverified until run: the combined-service response, whether WebSockets pass through Northflank's public port, and whether the Sandbox allows these plans. The image-based route (`NF_IMAGE`) remains in the script as a fallback, but it needs a registry first.

## 5. What I need from you to continue

- To deploy to Northflank: confirm you want me to proceed with your account. Either log in and share an API token, or connect the GitHub repo yourself and tell me the service URL.
- Do not share passwords. An API token is enough.
