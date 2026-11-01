# WordPress Enterprise Stack - 100% Native AWS Architecture (infoherd.com)

## 📋 Table of Contents
1. [Executive Overview](#executive-overview)
2. [Domain Architecture & Redirection](#domain-architecture--redirection)
3. [Admin Security (admin.infoherd.com)](#admin-security-admininfoherdcom)
4. [System Architecture Diagram](#system-architecture-diagram)
5. [Publishing Flow & Automation](#publishing-flow--automation)
6. [Search Implementation (Pagefind)](#search-implementation-pagefind)
7. [Cost Analysis](#cost-analysis)

---

## Executive Overview

This architecture implements a high-performance, single-provider **Static WordPress ("Bake & Serve")** platform tailored for **infoherd.com** and **infoherd.in** managed entirely within **AWS Route 53**:
- **Primary Public Website (`https://infoherd.com`):** Served globally via **Amazon CloudFront** backed by a private, encrypted **Amazon S3** static bucket.
- **Brand Protection & 301 Redirects (`infoherd.in` & `www.*`):** A lightweight CloudFront edge function automatically issues permanent 301 redirects to `https://infoherd.com`, preserving SEO equity and domain authority.
- **Admin Portal (`https://admin.infoherd.com`):** Secured by an AWS CloudFront distribution proxying to the isolated Graviton EC2 instance. The EC2 Security Group is restricted **strictly to AWS CloudFront Managed Prefix List** (`pl-9aa247f3`). General internet access to EC2 is 100% blocked.
- **Verification Header:** CloudFront injects a secret `X-Admin-Verify` token. Nginx rejects any direct or mismatched requests with `403 Forbidden`.
- **Zero Third-Party Dependencies:** 100% AWS Route 53, ACM SSL, CloudFront, S3, and EC2. No Cloudflare setup or nameserver migrations required.
- **Automated Backup & Disaster Recovery:** 
  - Dual-layer backup with AWS Data Lifecycle Manager (DLM) daily block-level snapshots (7-day retention).
  - Automated continuous MariaDB & media backups synced to S3 on publish and nightly via cron.
  - Automatic boot-time database and media restore if the EC2 instance is replaced or corrupted.
  - CloudWatch auto-recovery alarm (`StatusCheckFailed_System`) for automated physical host failure recovery.
- **Monthly Cost:** **~$14 – $18/month** (Customer KMS fee eliminated by using default AWS-managed encryption, ALB, WAF, and NAT gateways eliminated).

---

## Domain Architecture & Redirection

```
   User types:
   • infoherd.in
   • www.infoherd.in       ───▶ [ CloudFront Edge Function ] ──▶ 301 Redirect to https://infoherd.com
   • www.infoherd.com

   User types:
   • infoherd.com          ───▶ [ Public CloudFront CDN ] ─────▶ Serves Static HTML from S3 (< 50ms)

   Admin types:
   • admin.infoherd.com    ───▶ [ Admin CloudFront CDN ] ──────▶ Injects Secret Header ──▶ EC2 (Prefix List)
```

---

## System Architecture Diagram

```mermaid
flowchart TD
    subgraph CICD["🚀 Automated CI/CD (GitHub & AWS CodePipeline)"]
        GitRepo["GitHub Repository<br/>pushpsood/wpEnterpriseStack (main)"]
        CodeConn["AWS CodeConnections<br/>(OneHookClient-GitHub)"]
        Pipeline["AWS CodePipeline<br/>(wp-enterprise-cdk-pipeline)"]
        DeployStage["Single Prod Stage<br/>(Self-Mutating CloudFormation)"]
        
        GitRepo -->|Push to main| CodeConn
        CodeConn --> Pipeline
        Pipeline -->|Build & Synth| DeployStage
    end

    subgraph DNS["🌐 Unified DNS (AWS Route 53)"]
        R53Apex["infoherd.com (A Alias)"]
        R53In["infoherd.in (A Alias)"]
        R53Admin["admin.infoherd.com (A Alias)"]
    end

    subgraph EdgeCDN["⚡ Public Edge & CDN (infoherd.com)"]
        Reader["🌐 Public Visitors"]
        CF["Public CloudFront CDN<br/>(ACM SSL Cert: us-east-1)"]
        CFFunc["CloudFront Edge Function<br/>(301 Redirect: infoherd.in -> infoherd.com)"]
        OAC["Origin Access Control (OAC)"]
        S3["Amazon S3 Static Bucket<br/>(AES-256 Encrypted / Block Public Access)"]
        
        Reader -->|HTTPS| CF
        R53Apex --> CF
        R53In --> CF
        CF --> CFFunc
        CF --> OAC
        OAC --> S3
    end

    subgraph AdminEdge["🔒 Protected Admin Edge (admin.infoherd.com)"]
        Writer["✍️ Admin / Author"]
        AdminCF["Admin CloudFront Distribution<br/>(ACM SSL: us-east-1 / Caching Disabled)"]
        
        Writer -->|https://admin.infoherd.com| AdminCF
        R53Admin --> AdminCF
    end

    subgraph AWSVPC["🛡️ AWS Private Infrastructure (ap-south-1)"]
        subgraph AdminEC2["🖥️ Admin Server (Graviton t4g.small)"]
            SG["Security Group<br/>(Inbound: CloudFront Prefix Lists Only)"]
            Nginx["Nginx Reverse Proxy<br/>(Header Verification: X-Admin-Verify)"]
            WP["WordPress Core<br/>(Nginx + PHP-FPM 8.2)"]
            DB[("MariaDB 10.5")]
            Publisher["publish-static.sh<br/>(Static Exporter + Link Rewriter)"]
            SearchIndexer["Pagefind CLI<br/>(WASM Static Search Indexer)"]
        end
        
        AdminCF -->|HTTPS / Secret Header| SG
        SG --> Nginx
        Nginx --> WP
        WP --> DB
        WP -->|On Post Publish| Publisher
        Publisher --> SearchIndexer
        SearchIndexer -->|aws s3 sync| S3
        Publisher -->|aws cloudfront create-invalidation| CF
    end

    DeployStage ==>|Automated Deployment| EdgeCDN
    DeployStage ==>|Automated Deployment| AdminEdge
    DeployStage ==>|Automated Deployment| AWSVPC
```

---

## Cost Analysis

| Component | Specification | Estimated Monthly Cost |
| :--- | :--- | :--- |
| **Admin EC2** | 1x `t4g.small` (Graviton ARM, 2GB RAM) | **$12.26** (drops to ~$7.59 with 1-Yr Savings Plan) |
| **Public IPv4** | AWS IPv4 address for CloudFront origin routing | **$3.65** |
| **Route 53 DNS** | 2 zones (`infoherd.com`, `infoherd.in`) | **$1.00** |
| **Admin Security Group** | Inbound restricted to CloudFront Prefix List (No ALB, No NAT) | **$0.00** |
| **EBS Storage** | 20GB gp3 encrypted root volume (AWS-managed key) | **$1.76** |
| **KMS Encryption** | AWS-managed default key (`alias/aws/ebs`) | **$0.00** |
| **Automated Backups** | AWS DLM snapshots (7-day retention) + S3 DB/uploads | **~$0.25** |
| **Public S3** | Static HTML, CSS, media + backups | **~$0.05** |
| **CloudFront** | 2 Distributions (Always-Free Tier: 1TB + 10M requests) | **$0.00** |
| **ACM SSL Certificates** | 2 Multi-domain & Admin certs (`us-east-1`) | **$0.00** |
| **TOTAL** | | **~$18.97 / month** (~$14.30 with Savings Plan) |
