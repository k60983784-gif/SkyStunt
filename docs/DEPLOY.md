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

## 4. Several-day hosting (needs your account)

**Recommended: Northflank Sandbox.** The pricing page lists always-on compute, 2 free services, and 1 free database (F08). The page does not give the CPU or memory of a free service, so check the dashboard before deploying.

Steps (I have not done them; they need your account):
1. Create a Northflank account at `app.northflank.com/signup`. Accept the verification step if it asks for one.
2. Connect the repository (GitHub) or upload a Docker image built from step 3.
3. Create a **Combined service / Deployment** from the `Dockerfile`, port `8080`, health check `/healthz`.
4. Set a public port so Northflank gives an HTTPS URL. Check that WebSocket upgrades on `/ws` pass through; this is not verified yet.
5. Run the checks from section 2 against the new URL.

Other options and why they are weaker are in `HOSTING_SURVEY.md`. Render's free tier sleeps and drops WebSocket connections, and the Render blueprint in `render.yaml` uses the `starter` plan for that reason.

## 5. What I need from you to continue

- To deploy to Northflank: confirm you want me to proceed with your account. Either log in and share an API token, or connect the GitHub repo yourself and tell me the service URL.
- Do not share passwords. An API token is enough.
