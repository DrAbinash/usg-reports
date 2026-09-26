# USG Studio on a Windows PC (Docker Desktop)

Deploy USG Studio on a standard Windows PC in three steps. No coding required.

## What you need

- A Windows 10 or 11 PC (64-bit)
- An internet connection for the first install (to download Docker and the app image)
- About 4 GB free disk space

---

## Step 1 — Install Docker Desktop

1. Open a browser and go to:  
   **https://docs.docker.com/desktop/setup/install/windows-install/**
2. Download **Docker Desktop for Windows**.
3. Run the installer. Accept the defaults (WSL 2 is recommended if offered).
4. Restart the PC if the installer asks you to.
5. Start **Docker Desktop** from the Start menu.
6. Wait until the whale icon in the system tray says Docker is running (not “starting…”).

---

## Step 2 — Get the USG Studio folder

Put the full project folder on the PC (for example `C:\USG-Studio`).  
It must contain these files:

- `deploy-windows.bat`
- `docker-compose.windows.yml`
- `Dockerfile` (and the rest of the app source)

If you received a ZIP, extract it first.

---

## Step 3 — Run the deploy script

1. Double-click **`deploy-windows.bat`**.
2. The first run builds the app — this can take several minutes.
3. When it finishes, your browser should open **http://localhost:3000**.
4. Set your PIN / clinic branding under **Settings → Clinic Branding**.

Your reports and settings are stored in the **`usg-data`** folder next to the `.bat` file.  
Keep that folder when you update the software.

---

## Day-to-day use

| Action | How |
|--------|-----|
| Start the studio | Start Docker Desktop, then double-click `deploy-windows.bat` (or open http://localhost:3000 if the container is already running) |
| Stop the studio | Docker Desktop → Containers → stop `usg-studio`, or in the project folder run: `docker compose -f docker-compose.windows.yml down` |
| Backup | Copy the entire `usg-data` folder to a USB drive or cloud backup |

---

## Troubleshooting

- **“Docker was not found”** — Install Docker Desktop (Step 1) and reopen the Command Prompt / re-run the `.bat`.
- **“Docker Desktop is not running”** — Open Docker Desktop and wait until it is fully started.
- **Browser shows connection refused** — Wait 30–60 seconds after the first build, then refresh http://localhost:3000.
- **Port 3000 already in use** — Close the other app using port 3000, or edit `docker-compose.windows.yml` and change `"3000:3000"` to e.g. `"3040:3000"`, then open http://localhost:3040.

---

## White-label branding

After login: **Settings → Clinic Branding**

- Clinic name  
- Address  
- Clinic registration no.  
- Logo  
- Footer text  

These appear on printed reports and PDFs, and the clinic name shows in the app header.
