# Hosted OpenVSCode for Objectiv

Objectiv **defaults to hosted mode**: the desktop app embeds OpenVSCode from your VPS (no Docker on the Mac).

## VPS setup (same host as www.a-zing.org)

1. **DNS** — `A` or `CNAME` record **`tools.a-zing.org`** → VPS IP (same host as **www.a-zing.org**, default `84.46.249.107`).

2. **Deploy container** (publish port 3000 on localhost only):

   ```bash
   cd objectiv/deploy/openvscode-vps
   cp .env.example .env
   # Set OPENVSCODE_CONNECTION_TOKEN (openssl rand -hex 24)
   docker compose up -d
   ```

3. **Nginx** — Publish `3000` via TLS using `nginx/openvscode.conf` (WebSocket headers required). Map host port `3000:3000` in compose only if nginx runs on the same machine without Docker network; otherwise add to the host compose:

   ```yaml
   ports:
     - "127.0.0.1:3000:3000"
   ```

4. **TLS** — Obtain cert for `objectiv-vscode.a-zing.org` (certbot webroot, same pattern as other a-zing.org subdomains).

5. **Objectiv clients** — Settings → Objective → Extensions:
   - **OpenVSCode Mode:** Hosted (A-Zing VPS)
   - **Hosted URL:** `https://tools.a-zing.org`

Automated deploy from your Mac (SSH as root):

```bash
bash objectiv/deploy/openvscode-vps/deploy-to-a-zing-vps.sh
```
   - **Connection token:** same as `OPENVSCODE_CONNECTION_TOKEN` in `.env`

## Notes

- Workspaces and extensions live on the **VPS disk** (`openvscode_workspace` volume), not on the Mac.
- Use **Cloudflare Access** or VPN in addition to the connection token for production.
- **Local mode** (spawn on laptop) remains in Settings for offline dev; macOS no longer uses Docker by default.

See also [docs/OBJECTIV_OPENVSCODE.md](../../docs/OBJECTIV_OPENVSCODE.md).
