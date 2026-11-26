# GitHub owner security checklist

Repository: <https://github.com/SNU-Data-AI-Lab/lab-website>
Website: <https://da.snu.ac.kr/>
Audit date: 26 November 2026 (Asia/Seoul)

An existing repository administrator or organization owner should perform the
checks below and record the actual state, evidence date, reviewer and any
exception agreed with SNU IT. Do not mark an unchecked item satisfactory. The
audit connection has write access and no admin/maintain access; it cannot verify
these settings. These tasks do not require granting the auditor broader access.

## Changes to make in GitHub

### 1. Protect main (audit 4.1, 4.4)

Location: [Repository Settings → Rules → Rulesets](https://github.com/SNU-Data-AI-Lab/lab-website/settings/rules).
If rulesets are unavailable for the organization's plan, use the equivalent
branch protection settings for `main`.

- [ ] Create an **Active** branch ruleset targeting `main` (or the default branch).
- [ ] Require pull requests and at least **1 independent approving review**.
- [ ] Dismiss stale approvals when commits change the PR; require approval of the
  most recent reviewable push where available.
- [ ] Require the **Security validation** status check added by this PR. Let it
  run successfully once so it appears in the selector. Require the branch to be
  up to date before merging.
- [ ] Block force pushes and branch deletion. Apply the policy to administrators
  where supported; do not give ordinary writers a bypass. Document any narrowly
  scoped emergency bypass and who reviews its use.
- [ ] Confirm the website still deploys only from approved `main` changes.

Observed audit state: `main` reported `protected=false`, no required checks, and
an empty ruleset listing. This is a confirmed finding, not just a missing record.

### 2. Require organization MFA and review access (audit 1.1, 3.1–3.3, 3.6)

Locations: Organization Settings → Authentication security; Organization People;
Repository Settings → Collaborators and teams / Manage access.

- [ ] Require two-factor authentication for organization access. Prefer the
  **Only allow secure two-factor methods** option after checking readiness.
- [ ] Review the impact screen before enforcement: noncompliant outside
  collaborators may lose access. Verify current owners and an alternate have
  working MFA and recovery access first.
- [ ] Review every owner, team, member, outside collaborator and bot with access
  to this repository. Remove former/stale accounts; give read access unless a
  role needs to publish; reserve admin access for named responsible people.
- [ ] For contractors, record expiry/removal dates, minimum scope and MFA, or
  attest that there are no contractor accounts.
- [ ] Record the designated-device/access policy for GitHub administration. If
  SNU requires device/IP restrictions that the plan cannot enforce, obtain a
  documented SNU IT decision on an approved alternative. Do not claim that the
  absence of a site login satisfies GitHub administrator controls.
- [ ] Document GitHub sign-in protections and how suspicious sign-in/access
  events are reviewed. No live brute-force test is needed.

GitHub's [MFA instructions](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-two-factor-authentication-for-your-organization/requiring-two-factor-authentication-in-your-organization)
describe enforcement and its effect on access.

### 3. Confirm Pages and HTTPS (hosting, audit 1.1, 4.4)

Location: [Repository Settings → Pages](https://github.com/SNU-Data-AI-Lab/lab-website/settings/pages).

- [ ] Confirm Source is **Deploy from a branch**, branch **main**, folder
  **/(root)**. These are the effective values observed in deployment logs;
  record the actual UI state. This PR's `_config.yml` exclusions depend on
  keeping the Jekyll build. Do not switch to a raw repository upload that
  bypasses the exclusions.
- [ ] Confirm Custom domain is **da.snu.ac.kr**, DNS checks pass, the certificate
  is valid, and **Enforce HTTPS** is enabled.
- [ ] After this PR is merged and its Pages deployment succeeds, verify
  `/package.json`, `/package-lock.json`, `/extract.py`, `/docs/security-owner-checklist.md`
  and `/tests/security.test.cjs` return **404** on the website.
- [ ] Open Home, Members, Publications, Tools and the Java/C++ calculator;
  confirm header/footer loading, navigation, publication tabs, alumni lists,
  calculator modes and file reading work without CSP errors.

HTTP redirected to HTTPS and the certificate validated during the audit. Those
observations do not prove the checkbox is enabled or the domain is verified.
See [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

### 4. Verify the custom domain at organization level (hosting takeover control)

Location: [Organization Settings → Pages](https://github.com/organizations/SNU-Data-AI-Lab/settings/pages).

- [ ] Confirm `da.snu.ac.kr` is listed as a **verified domain** for
  `SNU-Data-AI-Lab`, or add and verify it using GitHub's displayed TXT challenge.
- [ ] Have the SNU DNS operator publish the exact challenge record GitHub
  supplies and retain it after verification. Do not invent the token or change
  unrelated SNU DNS records.
- [ ] Record the DNS operator and recovery contact. Reconfirm the website's
  intended GitHub Pages DNS records. The audit observed A `185.199.108.153`;
  this alone does not establish verified ownership.

[GitHub's domain verification instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
explain the organization/account-level setting. A valid TLS certificate is a
separate control.

### 5. Review Actions and deployment permissions (audit 3.5, 4.1)

Locations: Repository Settings → Actions → General; Repository Settings →
Environments → github-pages; Organization Settings → GitHub Apps / installed
apps; repository deploy keys, webhooks, secrets and variables settings.

- [ ] Enable Actions for this repository and permit the GitHub-authored
  `actions/checkout`, `actions/setup-node` and `actions/jekyll-build-pages`
  actions used by the validation workflow. Keep their reviewed SHA pins; the
  Dependabot configuration proposes updates to those pins.
- [ ] Set the default workflow token to read-only repository contents/packages
  where supported. Do not enable workflow PR creation/approval without a
  demonstrated need. The new validation workflow explicitly requests only
  `contents: read` and does not deploy.
- [ ] Confirm the built-in Pages deployment retains its necessary permission
  to publish (`pages: write`, observed in the successful deployment), without
  granting unrelated repository-write permissions to validation jobs.
- [ ] Inspect the `github-pages` environment's deployment branch policy and
  restrict production deployment to `main` where supported. Ensure a bypass
  cannot publish an arbitrary feature branch. If required reviewers are used,
  confirm the Pages deployment still completes with the documented approver.
- [ ] Inventory installed Apps, OAuth integrations, PATs, deploy keys, webhooks,
  bots and repository/environment secrets. Remove unused entries, restrict
  each to necessary resources/actions, and use expiry where supported.
- [ ] Inventory key/secret **names and owners**, not secret values in the PR or
  audit report. Rotate/revoke an exposed credential if one is discovered.

The audit saw masked credentials and a scoped Pages token in one successful
run; it did not establish that every integration is least-privilege.

### 6. Enable and review repository security features (audit 1.3, 3.4)

Location: Repository Settings → Security / Advanced Security (labels vary by
available features), plus the Security and quality tab.

- [ ] Enable **Dependabot alerts** and **Dependabot security updates** where
  available. Confirm the committed weekly npm and GitHub Actions version-update
  configuration is active and has a responsible reviewer.
- [ ] Confirm **secret scanning** and **push protection** are active where
  available. Review and resolve existing alerts; do not treat this PR's
  lockfile audit as a substitute for a secret alert review.
- [ ] Complete the credential review in collaboration tools and material
  outside reachable repository history. Record scope and outcome. The audit's
  bounded pattern scan found no matches but did not cover those sources.

### 7. Arrange sufficient log retention and review (audit 4.6, 5.3, 5.4)

Locations: Organization Settings → Audit log; Repository/Organization Settings →
Actions → General → **Check, workflow run, status, artifact and log retention**.

- [ ] Set repository retention to **90 days**, subject to the organization cap,
  and inspect any shorter per-artifact overrides. Do not mistake the built-in
  Pages artifact's one-day retention for request-log or audit-log retention.
- [ ] With SNU IT, define the logs that must be retained and export them to
  approved storage for **at least one year**, or **two years** if the institution
  determines the sensitive/unique-identifier rule applies. Public repository
  Actions retention cannot be set to 365 days; its maximum is 90 days.
- [ ] Schedule export often enough to preserve the shortest-lived required
  event type. Confirm actual availability for this organization/plan rather
  than assuming GitHub provides all request, authentication or Git events.
- [ ] Assign a reviewer for abnormal access, member/permission/key changes,
  failed checks and deployments. Define alerts, a review cadence and longer-term
  cumulative analysis with SNU IT. Review recent commits/deployments for
  authorization, not only byte equality with Git.
- [ ] Confirm authentication credentials are redacted and never deliberately
  logged. Document export access controls and evidence of periodic review.
- [ ] Ask the hosting provider/SNU IT what website request/security logs are
  available. If the required coverage is unavailable, agree on an approved
  fronting/hosting/monitoring arrangement or a documented exception; mark the
  requirement unresolved until that decision is recorded.

GitHub documents the [public-repository retention limit](https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization)
and [organization audit log coverage](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization).
Actions build logs are not website request logs. An HTML meta tag also cannot
configure HSTS, `X-Content-Type-Options` or CSP `frame-ancestors`; if required,
the owner must arrange server-set headers through a suitable hosting/fronting
layer and verify the actual HTTPS response.

## Decisions/evidence the owner must obtain with the lab and SNU IT

### 8. Confirm public data minimization (audit 5.1)

- [ ] Have the lab data owner approve the necessity and publication permission
  for member names, photos, roles, affiliations, research descriptions, emails
  and homepages. Check external recruitment/document sharing separately.
- [ ] Remove any unapproved field from the JSON and presentation. If private
  information was previously committed, agree on history/incident handling;
  deleting it from the current page does not remove public Git history.

### 9. Record managed-hosting responsibility (audit 1.2, 1.3, 4.2, 4.3, 4.5, 5.2)

- [ ] Obtain SNU IT agreement that this is a static public Pages application
  without a lab-managed web server, database, private-network integration,
  login/API service or server upload directory. Record which checklist items
  are N/A for the lab application and which are provider responsibilities.
- [ ] Obtain appropriate evidence/attestation for provider patching, network
  isolation, endpoint protection and time synchronization, as required by SNU.
- [ ] Verify EDR/antivirus and clock synchronization on lab-managed machines
  used to administer the repository. No shared GitHub infrastructure port scan
  was performed or is implied by the audit.
- [ ] If SNU mandates wscan, have the responsible SNU operator arrange the
  correctly scoped website scan and attach the result. It was not run in the
  repository audit.

### 10. Own backup, restoration and incident response (audit 6.1, 6.2)

- [ ] Assign a named primary and alternate for GitHub administration, website
  changes, DNS recovery and incident escalation.
- [ ] Establish scheduled off-device source/asset backups and a separate
  inventory of Pages, access, integration and DNS settings. Keep credentials
  in the approved credential store, not in backups committed to this public repo.
- [ ] Set retention, recovery objectives and a repeat restore-test cadence.
  The audit's one-time local Git bundle successfully restored the audited
  commit, but it is not an ongoing backup or a settings/DNS backup.
- [ ] Record how an authorized owner can stop publication, preserve relevant
  logs, revert to a known approved commit, revoke compromised access and recover
  DNS. Rehearse this procedure without disrupting the public site.
- [ ] Verify the contact tree. The supplied advisory lists SNU CERT
  `snucert@snu.ac.kr` / `02-880-5382` and Ministry of Education ECSC
  `cert1@ecsc.go.kr` / `053-714-0777`; record the lab lead and alternate alongside
  the verified institutional contacts.
- [ ] Resolve the open evidence items and have the responsible institution
  review the final 30-item results before submission. The supplied notice's
  deadline is Monday, **30 November 2026**; no submission is automated by this PR.

## Evidence record

For each numbered task above, record: reviewer, date, setting/value or decision,
evidence location, and remaining action/owner. Keep sensitive screenshots,
member/access inventories and exported logs in approved restricted storage;
this repository and its PRs are public. Link the evidence by reference without
posting secrets or private account information here.
