# 🚀 Deployment Guide

This document explains how to deploy the Data-Driven Insights Assistant using GitLab CI/CD pipeline.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [GitLab CI/CD Variables Setup](#gitlab-cicd-variables-setup)
- [Pipeline Structure](#pipeline-structure)
- [Deployment Process](#deployment-process)
- [Environment Configuration](#environment-configuration)
- [Monitoring & Rollback](#monitoring--rollback)
- [Troubleshooting](#troubleshooting)

---

## Overview

The project includes a comprehensive GitLab CI/CD pipeline (`.gitlab-ci.yml`) with four stages:

1. **Test Stage** - Runs on every push/MR
   - Frontend linting and build
   - Backend linting and type checking

2. **Build Stage** - Builds and pushes Docker images
   - Multi-platform builds (amd64/arm64)
   - Automatic semantic versioning
   - Pushes to Docker Hub

3. **Security Stage** - Security scanning
   - Trivy vulnerability scanner (dependencies and container images)
   - Gitleaks secret scanner (API keys, passwords, tokens)
   - Checks for HIGH/CRITICAL vulnerabilities

4. **Deploy Stage** - Environment deployments
   - Staging deployment (manual trigger)
   - Production deployment (manual trigger on tags)
   - Rollback capability

---

## Prerequisites

Before deploying, ensure you have:

1. **GitLab Repository** - Project pushed to GitLab
2. **GitLab Runner** - Self-hosted or GitLab.com shared runners
3. **Docker Hub Account** - For storing container images ([Sign up](https://hub.docker.com/))
4. **Deployment Target** - Server(s) for staging/production (e.g., AWS, GCP, DigitalOcean)
5. **OpenAI API Key** - For production environment

---

## GitLab CI/CD Variables Setup

Navigate to your GitLab project: **Settings → CI/CD → Variables**

Add the following CI/CD variables:

| Variable Name | Type | Description | Example | Protected | Masked |
|--------------|------|-------------|---------|-----------|--------|
| `DOCKER_HUB_USERNAME` | Variable | Your Docker Hub username | `myusername` | No | No |
| `DOCKER_HUB_TOKEN` | Variable | Docker Hub access token | `dckr_pat_xxxxx` | Yes | Yes |
| `OPENAI_API_KEY` | Variable | OpenAI API key | `sk-xxxxx` | Yes | Yes |
| `STAGING_HOST` | Variable | Staging server hostname | `staging.example.com` | No | No |
| `STAGING_USER` | Variable | SSH user for staging | `deploy` | No | No |
| `STAGING_SSH_KEY` | File | SSH private key for staging | (file contents) | Yes | No |
| `STAGING_URL` | Variable | Staging application URL | `https://staging.example.com` | No | No |
| `PRODUCTION_HOST` | Variable | Production server hostname | `app.example.com` | Yes | No |
| `PRODUCTION_USER` | Variable | SSH user for production | `deploy` | Yes | No |
| `PRODUCTION_SSH_KEY` | File | SSH private key for production | (file contents) | Yes | Yes |
| `PRODUCTION_URL` | Variable | Production application URL | `https://app.example.com` | Yes | No |

### Getting Docker Hub Access Token

1. Log in to [Docker Hub](https://hub.docker.com/)
2. Go to **Account Settings → Security**
3. Click **New Access Token**
4. Name: `gitlab-ci`, Permissions: **Read, Write, Delete**
5. Copy token and add to GitLab CI/CD variables

### Variable Settings

- **Protected**: Only available in protected branches (main, tags)
- **Masked**: Value hidden in job logs
- **File**: Creates a file with the variable content (useful for SSH keys)

---

## Pipeline Structure

### Pipeline Stages

```yaml
stages:
  - test      # Linting, building, testing
  - build     # Docker image builds
  - deploy    # Environment deployments
  - security  # Vulnerability scanning
```

### Jobs Overview

| Job | Stage | Triggers | Description |
|-----|-------|----------|-------------|
| `frontend:test` | test | All branches, MRs, tags | npm lint + build |
| `backend:test` | test | All branches, MRs, tags | flake8 + mypy |
| `build:frontend` | build | main, develop, tags | Build & push frontend image |
| `build:backend` | build | main, develop, tags | Build & push backend image |
| `security:scan` | security | All branches, MRs, tags | Trivy vulnerability scan |
| `security:secrets` | security | All branches, MRs, tags | Gitleaks secret scanning |
| `deploy:staging` | deploy | develop (manual) | Deploy to staging |
| `deploy:production` | deploy | tags (manual) | Deploy to production |
| `rollback:production` | deploy | tags (manual) | Rollback production |

### Pipeline Triggers

- **Push to main/develop**: Runs test + build stages
- **Merge Request**: Runs test + security stages
- **Tag Push** (v*): Runs all stages, enables production deployment
- **Manual Jobs**: Staging and production deployments require manual trigger

---

## Deployment Process

### Option 1: Production Release (Recommended)

Create and push a version tag:

```bash
# 1. Ensure code is committed
git add .
git commit -m "Release v1.0.0"

# 2. Create semantic version tag
git tag v1.0.0

# 3. Push code and tag
git push origin main
git push origin v1.0.0
```

**What happens:**
1. Pipeline starts automatically
2. Test jobs run (frontend + backend)
3. Docker images build with version tags
4. Images pushed to Docker Hub with tags: `v1.0.0`, `1.0`, `1`, `latest`
5. Security scan runs
6. Production deployment job becomes available (manual trigger)

**To deploy:**
1. Go to **CI/CD → Pipelines**
2. Click on the pipeline for tag `v1.0.0`
3. Find `deploy:production` job
4. Click **▶ Play** button to trigger deployment

### Option 2: Staging Deployment

Push to `develop` branch:

```bash
git checkout develop
git merge main
git push origin develop
```

**To deploy:**
1. Go to **CI/CD → Pipelines**
2. Click on the pipeline for `develop` branch
3. Find `deploy:staging` job
4. Click **▶ Play** button to trigger deployment

### Option 3: Manual Deployment Script

Use the deployment script:

```bash
# Set required environment variables
export DOCKER_HUB_USERNAME=your-username
export DOCKER_HUB_TOKEN=your-token

# Deploy to staging
./scripts/deploy.sh staging v1.0.0

# Deploy to production
./scripts/deploy.sh production v1.0.0
```

---

## Environment Configuration

### Staging Environment

Edit `.gitlab-ci.yml` (lines 196-205) to configure your staging deployment:

```yaml
deploy:staging:
  script:
    - echo "🚀 Deploying to staging environment..."
    - |
      # Uncomment and configure for your environment
      mkdir -p ~/.ssh
      echo "$STAGING_SSH_KEY" > ~/.ssh/id_rsa
      chmod 600 ~/.ssh/id_rsa
      ssh-keyscan -H $STAGING_HOST >> ~/.ssh/known_hosts
      ssh $STAGING_USER@$STAGING_HOST "cd /app && docker-compose pull && docker-compose up -d"
  environment:
    name: staging
    url: https://staging.example.com  # Update with your staging URL
```

### Production Environment

Edit `.gitlab-ci.yml` (lines 215-248) to configure your production deployment:

```yaml
deploy:production:
  script:
    - echo "🚀 Deploying to production environment..."
    - |
      # Choose your deployment method:

      # Option 1: SSH Deployment (VM/VPS)
      mkdir -p ~/.ssh
      echo "$PRODUCTION_SSH_KEY" > ~/.ssh/id_rsa
      chmod 600 ~/.ssh/id_rsa
      ssh-keyscan -H $PRODUCTION_HOST >> ~/.ssh/known_hosts
      ssh $PRODUCTION_USER@$PRODUCTION_HOST \
        "cd /app && \
         export VERSION=$CI_COMMIT_TAG && \
         docker-compose pull && \
         docker-compose up -d"

      # Option 2: Kubernetes
      apk add --no-cache kubectl
      echo "$KUBECONFIG" > ~/.kube/config
      kubectl set image deployment/frontend \
        frontend=$REGISTRY/$DOCKER_HUB_USERNAME/$FRONTEND_IMAGE_NAME:$CI_COMMIT_TAG
      kubectl set image deployment/backend \
        backend=$REGISTRY/$DOCKER_HUB_USERNAME/$BACKEND_IMAGE_NAME:$CI_COMMIT_TAG

      # Option 3: AWS ECS
      apk add --no-cache aws-cli
      aws ecs update-service \
        --cluster my-cluster \
        --service my-service \
        --force-new-deployment
```

---

## Monitoring & Rollback

### Health Checks

Both staging and production deployments include health checks:

```yaml
- echo "🏥 Running health checks..."
- sleep 10
- curl -f $PRODUCTION_URL/api/health || exit 1
```

**Update health check URLs** in `.gitlab-ci.yml`:
- Staging: Line 205
- Production: Line 241

### Viewing Deployments

1. Go to **Deployments → Environments**
2. View deployment history for staging/production
3. Click on environment to see current status

### Manual Rollback

**Option 1: Via GitLab UI**
1. Go to **Deployments → Environments**
2. Select **production** environment
3. Find previous successful deployment
4. Click **Rollback** button

**Option 2: Via Pipeline**
1. Go to **CI/CD → Pipelines**
2. Find the pipeline with the version to rollback to
3. Click **▶ Play** on `rollback:production` job

**Option 3: Via Git Tag**
```bash
# Checkout previous version
git checkout v1.0.0

# Create new patch version
git tag v1.0.1

# Push and deploy
git push origin v1.0.1
```

---

## Troubleshooting

### Pipeline Failures

**Problem**: Pipeline stuck on "Pending"

**Solution**:
1. Check if GitLab Runner is available: **Settings → CI/CD → Runners**
2. Ensure runners have Docker executor configured
3. Check runner tags match job requirements

### Build Failures

**Problem**: Docker build fails with `error: failed to solve`

**Solution**:
1. Check Dockerfile syntax
2. Verify base image availability
3. Check network connectivity on runner
4. Review build logs in job output

### Docker Login Issues

**Problem**: `Error response from daemon: Get "https://registry-1.docker.io/v2/": unauthorized`

**Solution**:
1. Verify `DOCKER_HUB_USERNAME` variable is correct (not email)
2. Regenerate `DOCKER_HUB_TOKEN` and update GitLab variable
3. Ensure token is marked as **Masked**
4. Check token permissions include Read/Write

### SSH Deployment Failures

**Problem**: `Permission denied (publickey)`

**Solution**:
1. Verify SSH key format is correct (PEM format)
2. Use **File** type for `*_SSH_KEY` variables
3. Ensure public key is in `~/.ssh/authorized_keys` on target server
4. Test SSH connection manually from runner

### Multi-platform Build Issues

**Problem**: `error: multiple platforms feature is currently not supported`

**Solution**:
1. Ensure runner has Docker 19.03+ with buildx
2. Enable Docker experimental features
3. Or remove `--platform` flag and build single platform

### Security Scan Blocking Pipeline

**Problem**: Trivy scan fails with HIGH/CRITICAL vulnerabilities

**Solution**:
1. Review vulnerability report in job logs
2. Update base images in Dockerfiles
3. Update dependencies (package.json, requirements.txt)
4. Set `allow_failure: true` temporarily (not recommended for production)

### Secret Scanning Failures

**Problem**: `security:secrets` job fails with "Found X potential secrets"

**Solution**:
1. Review the `gitleaks-report.json` artifact in the pipeline
2. Check if secrets are actually committed:
   - Remove real API keys, tokens, passwords from code
   - Move secrets to GitLab CI/CD Variables
   - Use `.env.example` with placeholder values
3. If false positive, add to `.gitleaks.toml` allowlist:
   ```toml
   [[allowlist.regexes]]
   regex = '''your-false-positive-pattern'''
   description = "False positive description"
   ```
4. Common false positives:
   - Example/placeholder keys in documentation
   - Test fixtures with dummy data
   - Hashed values that look like keys

**Preventing Secret Leaks:**
- Never commit `.env` files (already in `.gitignore`)
- Use environment variables for all secrets
- Review code before committing: `git diff`
- Use pre-commit hooks locally:
  ```bash
  # Install gitleaks locally
  brew install gitleaks  # macOS
  # or download from https://github.com/gitleaks/gitleaks

  # Run before committing
  gitleaks detect --source . --config .gitleaks.toml
  ```

### Common GitLab CI/CD Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `variable not found` | Variable not set | Add variable in Settings → CI/CD → Variables |
| `This job is stuck` | No runners available | Enable shared runners or register runner |
| `error during connect: Post "http://docker:2375/v1.24/build"` | Docker service not available | Add `docker:dind` service to job |
| `insufficient_scope: authorization failed` | Wrong Docker credentials | Check DOCKER_HUB_USERNAME and TOKEN |
| `fatal: remote error: upload-pack: not our ref` | Protected branch | Verify branch protection settings |

---

## Docker Image Tags

Images are tagged with multiple patterns based on the Git ref:

| Git Ref | Tags Generated | Use Case |
|---------|---------------|----------|
| Tag `v1.2.3` | `v1.2.3`, `1.2`, `1`, `latest` | Production release |
| Branch `main` | `latest`, `main-abc123` | Latest stable |
| Branch `develop` | `develop-abc123` | Development |
| Other branches | `branch-name-abc123` | Feature branches |

**Pull specific version:**
```bash
docker pull yourusername/data-insight-frontend:v1.0.0
docker pull yourusername/data-insight-backend:v1.0.0
```

**Pull latest:**
```bash
docker pull yourusername/data-insight-frontend:latest
docker pull yourusername/data-insight-backend:latest
```

---

## GitLab Runner Setup

### Using GitLab.com Shared Runners

1. Go to **Settings → CI/CD → Runners**
2. Enable shared runners
3. No additional setup required

### Setting up Self-Hosted Runner

```bash
# 1. Install GitLab Runner
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
sudo apt-get install gitlab-runner

# 2. Register runner
sudo gitlab-runner register \
  --url https://gitlab.com/ \
  --registration-token YOUR_TOKEN \
  --executor docker \
  --docker-image alpine:latest \
  --description "Docker Runner" \
  --docker-privileged

# 3. Start runner
sudo gitlab-runner start
```

**For Docker-in-Docker support:**
- Use `--docker-privileged` flag
- Or add to `/etc/gitlab-runner/config.toml`:
```toml
[[runners]]
  [runners.docker]
    privileged = true
```

---

## Production Checklist

Before first production deployment:

- [ ] Configure all GitLab CI/CD variables
- [ ] Enable GitLab Runner (shared or self-hosted)
- [ ] Update deployment URLs in `.gitlab-ci.yml`
- [ ] Uncomment and configure deployment commands
- [ ] Test staging deployment first
- [ ] Configure health check endpoints
- [ ] Set up monitoring (Datadog, New Relic, etc.)
- [ ] Configure log aggregation (ELK, Splunk, etc.)
- [ ] Set up SSL/TLS certificates
- [ ] Configure CORS_ORIGINS for production domain
- [ ] Test rollback procedure
- [ ] Document runbook for on-call engineers
- [ ] Set up protected branches and tags

---

## Additional Resources

- **GitLab CI/CD Docs**: https://docs.gitlab.com/ee/ci/
- **Docker Hub**: https://hub.docker.com/
- **GitLab Runners**: https://docs.gitlab.com/runner/
- **Semantic Versioning**: https://semver.org/
- **GitLab Environments**: https://docs.gitlab.com/ee/ci/environments/

---

## Pipeline Optimization Tips

1. **Use caching**: Cache `node_modules/` and pip dependencies
2. **Artifacts**: Pass build artifacts between stages
3. **Parallel jobs**: Run independent jobs in parallel
4. **Docker layer caching**: Use GitLab Container Registry for layer caching
5. **Rules**: Use `rules:` instead of `only:`/`except:` for complex conditions
6. **Scheduled pipelines**: Set up nightly security scans

**Example caching:**
```yaml
cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .npm/
```

---

**Need Help?**
- Check pipeline logs: **CI/CD → Pipelines → [Pipeline] → [Job]**
- View runner logs: `sudo gitlab-runner logs`
- GitLab Community Forum: https://forum.gitlab.com/

---

*Last Updated: November 2024*
