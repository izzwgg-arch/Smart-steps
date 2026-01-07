# Setting Up GitHub/GitLab Remote

## Step 1: Create Repository (if you don't have one)

### On GitHub:
1. Go to https://github.com/new
2. Repository name: `aplus-center` (or your preferred name)
3. Choose Private or Public
4. **DO NOT** initialize with README, .gitignore, or license (we already have files)
5. Click "Create repository"

### On GitLab:
1. Go to your GitLab dashboard
2. Click "New project" → "Create blank project"
3. Project name: `aplus-center`
4. **DO NOT** initialize with README
5. Click "Create project"

## Step 2: Get Repository URL

After creating, you'll see a page with commands. Copy the repository URL:
- HTTPS: `https://github.com/yourusername/aplus-center.git`
- SSH: `git@github.com:yourusername/aplus-center.git`

## Step 3: Add Remote and Push

Once you have the URL, run these commands:

```powershell
cd "c:\dev\projects\A Plus center"

# Add remote (replace with your actual URL)
git remote add origin https://github.com/yourusername/aplus-center.git

# Rename branch to main (if needed)
git branch -M main

# Push to remote
git push -u origin main
```

## Authentication

If using HTTPS, you may need to:
- Use a Personal Access Token (GitHub) or Access Token (GitLab)
- Or set up SSH keys for easier authentication

If using SSH, make sure your SSH key is added to your GitHub/GitLab account.

## After Pushing

Once pushed, you can deploy to the server:

```bash
ssh -i ~/.ssh/id_ed25519_smartsteps -o IdentitiesOnly=yes root@66.94.105.43

cd /var/www/aplus-center

# If first time, clone:
git clone https://github.com/yourusername/aplus-center.git .

# Or if already cloned, pull:
git pull origin main

# Then deploy:
npm install --production --legacy-peer-deps
npx prisma generate
npm run build
pm2 restart aplus-center
pm2 status
```
