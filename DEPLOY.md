# MyTube Deployment Guide — dyabavadra.com

This guide walks you through deploying MyTube to your custom domain.

## What Was Prepared

- ✅ Removed hardcoded Jellyfin credentials from SettingsDialog
- ✅ Switched database from SQLite → PostgreSQL (cloud-compatible)
- ✅ Disabled Prisma query logging in production
- ✅ Removed `output: "standalone"` (not needed for Vercel)
- ✅ Created database migration files
- ✅ Updated build scripts

## Environment Variables Needed

Set these in your deployment platform:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/mytube?sslmode=require` |

---

## Option A: Vercel Deployment (Recommended)

Vercel is the official deployment platform for Next.js with automatic HTTPS, global CDN, and zero-config deployments.

### Step 1: Push to GitHub

```bash
cd /home/z/my-project
git add -A
git commit -m "Prepare for production deployment"
git remote add origin https://github.com/YOUR_USERNAME/mytube.git
git push -u origin main
```

### Step 2: Create a PostgreSQL Database

Use **any** of these free-tier providers:

- **Neon** (recommended): https://neon.tech — Free PostgreSQL, serverless
- **Supabase**: https://supabase.com — Free PostgreSQL with dashboard
- **Vercel Postgres**: Available in Vercel dashboard

After creating, copy the connection string (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/mytube?sslmode=require`)

### Step 3: Deploy on Vercel

1. Go to https://vercel.com and sign up/log in (use GitHub for easiest setup)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `bun run build`
   - **Install Command**: `bun install`
   - **Output Directory**: `.next` (auto-detected)
5. Add **Environment Variables**:
   - `DATABASE_URL` = your PostgreSQL connection string
6. Click **"Deploy"**

### Step 4: Run Database Migration

After the first deploy, run the migration:

```bash
# Install Vercel CLI if not already
npm i -g vercel

# Login
vercel login

# Link to your project
cd /home/z/my-project
vercel link

# Run migration against production database
vercel env pull .env.production
DATABASE_URL="<your-postgres-url>" npx prisma migrate deploy
```

### Step 5: Add Custom Domain

1. Go to your Vercel project dashboard
2. Click **Settings** → **Domains**
3. Add `dyabavadra.com` and `www.dyabavadra.com`
4. Vercel will show you the DNS records to add:

   **For dyabavadra.com (A Record):**
   - Type: `A`
   - Name: `@`
   - Value: `76.76.21.21`

   **For www.dyabavadra.com (CNAME):**
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com`

5. Go to your domain registrar (where you bought dyabavadra.com)
6. Add the DNS records shown by Vercel
7. Wait 5-30 minutes for DNS propagation
8. Vercel automatically provisions SSL certificates

### Step 6: Verify

Visit https://dyabavadra.com — your MyTube app should be live!

---

## Option B: Self-Hosted VPS Deployment (Docker)

If you prefer to host on your own server (e.g., the same server running Jellyfin):

### Step 1: Create a Dockerfile

A Dockerfile is provided at `/home/z/my-project/Dockerfile`

### Step 2: Build & Run

```bash
# On your VPS
git clone https://github.com/YOUR_USERNAME/mytube.git
cd mytube

# Build
docker build -t mytube .

# Run with PostgreSQL
docker run -d \
  --name mytube \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@localhost:5432/mytube" \
  mytube
```

### Step 3: Configure Nginx/Caddy Reverse Proxy

```nginx
# /etc/nginx/sites-available/dyabavadra.com
server {
    listen 80;
    server_name dyabavadra.com www.dyabavadra.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then add SSL with Certbot: `sudo certbot --nginx -d dyabavadra.com -d www.dyabavadra.com`

---

## Post-Deployment: Connect Your Jellyfin

After deployment, open the app at your domain:

1. Click the **Settings** gear icon
2. Enter your Jellyfin server URL: `https://manitou.dyabavadra.com`
3. Enter your Jellyfin username and password
4. Click **Connect**

Your media library will appear in the app!

---

## Quick Deploy Commands (Vercel CLI)

If you prefer the CLI over the web dashboard:

```bash
# Login to Vercel
vercel login

# Deploy (from project root)
cd /home/z/my-project
vercel

# Add custom domain
vercel domains add dyabavadra.com
vercel domains add www.dyabavadra.com

# Set environment variable
vercel env add DATABASE_URL production

# Redeploy with env vars
vercel --prod
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails with Prisma error | Ensure `DATABASE_URL` is set as env var |
| Database connection error | Check PostgreSQL URL format and SSL mode |
| Images not loading from Jellyfin | Ensure Jellyfin allows CORS from your domain |
| Domain not resolving | Check DNS records, wait for propagation |
| 502 Bad Gateway | App may still be building, wait 1-2 minutes |
