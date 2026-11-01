# WordPress Enterprise Stack - 100% Native AWS Architecture

Production-ready, highly secure, and ultra-low latency **Static WordPress ("Bake & Serve")** infrastructure on AWS configured for **infoherd.com** and **infoherd.in**.

Combines the familiar editing power of **WordPress** on **admin.infoherd.com** (secured via AWS CloudFront with Managed Prefix List filtering and secret header verification) with a **100% stateless public edge on infoherd.com (S3 + CloudFront)** and **Pagefind WASM search**.

---

## Architecture Summary

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
        CF["Amazon CloudFront CDN<br/>(ACM SSL Cert: us-east-1)"]
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

    subgraph ProtectedAdmin["🔒 Protected Admin Edge (admin.infoherd.com)"]
        Writer["✍️ Authorized Writers"]
        AdminCF["Admin CloudFront Distribution<br/>(ACM SSL: us-east-1 / Caching Disabled)"]
        
        Writer -->|https://admin.infoherd.com| AdminCF
        R53Admin --> AdminCF
    end

    subgraph AWSVPC["🛡️ AWS Private Infrastructure (ap-south-1)"]
        subgraph AdminEC2["🖥️ Admin Server (Graviton t4g.small)"]
            SG["Security Group<br/>(Inbound: CloudFront Prefix List pl-9aa247f3 Only)"]
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
    DeployStage ==>|Automated Deployment| ProtectedAdmin
    DeployStage ==>|Automated Deployment| AWSVPC
```

- **`https://infoherd.com`**: Primary public website. Ultra-low latency (< 50ms TTFB) served by CloudFront from private S3 with Origin Access Control.
- **`infoherd.in` & `www.*`**: Automatically 301-redirected to `https://infoherd.com` at the CloudFront edge via edge function.
- **`https://admin.infoherd.com`**: Editorial portal. Direct public internet access is 100% blocked at the security group level. Inbound traffic is strictly restricted to AWS CloudFront's Managed Prefix List (`pl-9aa247f3`) with custom `X-Admin-Verify` token inspection.
- **100% Unified in AWS Route 53**: No external DNS providers or third-party tunnels required.
- **Monthly Cost:** **~$15 – $18/month** (ALB, WAF, and NAT gateways eliminated).

---

## Architecture Highlights

1. **Static Baking Pipeline:** When an author creates or updates posts in WordPress, `/var/www/scripts/publish-static.sh` renders the site into static HTML/CSS/JS, runs Pagefind WASM indexing, rewrites internal `admin.infoherd.com` URLs to `infoherd.com`, syncs to S3, and invalidates CloudFront.
2. **AWS Systems Manager (SSM):** Fully managed, browser-based secure shell access into the EC2 instance with zero open SSH ports (port 22 closed, no keypairs required).
3. **Self-Mutating CI/CD Pipeline:** Commits to `main` automatically trigger AWS CodePipeline to build, synth, self-mutate, and deploy all infrastructure stacks across `us-east-1` (ACM) and `ap-south-1` (App & EC2).

---

## License

MIT
