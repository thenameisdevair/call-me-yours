# CMY Git Conventions and Branching Strategy

These conventions exist for two reasons:
1. Celo Proof of Ship (PoS) AI agents read commit history to evaluate builder
   activity. Meaningful, structured commits directly impact PoS scoring.
2. Clean history makes feature tracking, rollback, and code review possible
   as the project scales.

---

## Branch Structure

```
main                    ← production only. Protected. Never commit directly.
└── dev                 ← active development base. All features branch from here.
    ├── feat/smart-contract-core
    ├── feat/profile-setup
    ├── feat/discovery-feed
    ├── feat/connection-request
    ├── feat/xmtp-chat
    ├── feat/milestone-engine
    ├── feat/gift-system
    ├── fix/[description]
    └── chore/[description]
```

### Branch Rules

| Branch | Rule |
|---|---|
| `main` | Never commit directly. Only receives merges from `dev` after full feature completion and testing. Represents deployable state. |
| `dev` | Base for all feature branches. Always kept stable. Merge features here first. |
| `feat/*` | One branch per feature. Branch from `dev`. Merge back to `dev` via PR when complete. |
| `fix/*` | Bug fixes. Branch from `dev` (or `main` for critical hotfixes). |
| `chore/*` | Non-feature work — config, dependencies, documentation, skills. |

### Creating a Feature Branch

```bash
# Always branch from dev
git checkout dev
git pull origin dev
git checkout -b feat/connection-request

# Work, commit, push
git add .
git commit -m "feat(contract): add sendConnectionRequest function"
git push origin feat/connection-request

# When complete — merge back to dev
git checkout dev
git merge feat/connection-request
git push origin dev

# When dev is stable and tested — merge to main
git checkout main
git merge dev
git push origin main
```

---

## Commit Convention

CMY uses Conventional Commits (https://www.conventionalcommits.org).
This format is required — not optional. PoS AI agents parse commit messages.
Vague commits like "update stuff" or "fix" contribute nothing to PoS scoring.

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | When to Use |
|---|---|
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `test` | Adding or updating tests |
| `refactor` | Code restructuring with no behavior change |
| `chore` | Dependencies, config, tooling, documentation |
| `style` | UI/UX changes, design updates |
| `perf` | Performance improvements |
| `security` | Security fixes or hardening |
| `deploy` | Deployment to testnet or mainnet |

### Scopes

Use scopes to identify which part of the system the commit affects:

| Scope | Refers To |
|---|---|
| `contract` | Smart contract code (CMY.sol) |
| `test` | Foundry tests |
| `deploy` | Deployment scripts |
| `profile` | Profile creation and management features |
| `discovery` | Discovery feed |
| `connection` | Connection request flow |
| `chat` | XMTP messaging |
| `milestone` | Milestone engine |
| `gift` | Gift system |
| `auth` | MiniPay detection and wallet handling |
| `db` | Supabase schema or queries |
| `ui` | UI components |
| `hooks` | React hooks |
| `config` | Project configuration |
| `skill` | Claude Code agent skills |
| `docs` | Documentation |

### Examples

```bash
# Smart contract
git commit -m "feat(contract): add sendConnectionRequest with USDm fee transfer"
git commit -m "feat(contract): implement sendGift with full amount to recipient"
git commit -m "feat(contract): add recordMilestone event emission"
git commit -m "feat(contract): add onlyOwner updatePlatformWallet function"
git commit -m "fix(contract): add nonReentrant guard to sendGift"
git commit -m "test(contract): add reentrancy attack test for sendGift"
git commit -m "test(contract): add 30-day cooldown enforcement test"
git commit -m "security(contract): add SelfConnection custom error"
git commit -m "deploy(contract): deploy CMY.sol to Celo Sepolia"
git commit -m "deploy(contract): verify CMY.sol on Celoscan Sepolia"
git commit -m "deploy(contract): deploy CMY.sol to Celo Mainnet"

# Frontend
git commit -m "feat(auth): add MiniPay detection and implicit wallet connection"
git commit -m "feat(auth): redirect to add cash deeplink on insufficient balance"
git commit -m "feat(profile): build profile creation form with photo upload"
git commit -m "feat(profile): add age validation — enforce 18+ minimum"
git commit -m "feat(profile): add 200KB photo compression before upload"
git commit -m "feat(discovery): build randomized profile discovery feed"
git commit -m "feat(discovery): add gender preference filtering"
git commit -m "feat(connection): build connection request confirmation modal"
git commit -m "feat(connection): implement USDm approval + fee transfer flow"
git commit -m "feat(chat): integrate XMTP for E2E encrypted messaging"
git commit -m "feat(chat): add match-gated chat access control"
git commit -m "feat(milestone): implement consecutive day streak detection"
git commit -m "feat(milestone): build milestone notification component"
git commit -m "feat(gift): build gift catalogue UI"
git commit -m "feat(gift): implement on-chain gift send flow"
git commit -m "style(ui): apply Impeccable design system to discovery feed"
git commit -m "style(ui): implement DM Serif Display + Plus Jakarta Sans typography"

# Database
git commit -m "chore(db): create profiles table schema"
git commit -m "chore(db): create matches and connection_requests tables"
git commit -m "chore(db): create milestones and chat_sessions tables"
git commit -m "chore(db): add RLS policies to profiles table"

# Project setup
git commit -m "chore(config): scaffold project with Celo Composer MiniPay template"
git commit -m "chore(skill): add CMY custom Claude Code skill"
git commit -m "chore(skill): install Celo agent skills"
git commit -m "chore(skill): install Impeccable design skill"
git commit -m "docs: add SDLC Phase 1 planning document"
git commit -m "docs: add SDLC Phase 2 requirements document"
git commit -m "docs: add SDLC Phase 3 system design document"
```

### What Makes a Bad Commit

```bash
# WRONG — vague, meaningless, contributes nothing to PoS scoring
git commit -m "update"
git commit -m "fix stuff"
git commit -m "changes"
git commit -m "wip"
git commit -m "asdfgh"
git commit -m "."

# WRONG — too broad, should be split into multiple commits
git commit -m "add all features"
git commit -m "build the whole frontend"
```

---

## Proof of Ship Commit Cadence

To maximize PoS scoring, commits must be:

- **Frequent** — at least 3-5 meaningful commits per active development day
- **Specific** — each commit represents one logical unit of work
- **Descriptive** — commit message tells the reader exactly what changed and why
- **Consistent** — commit throughout the build, not in one large dump at the end

Karma tracks GitHub activity over time. A single large commit at the end of a
month scores significantly lower than consistent daily commits showing real
incremental progress.

---

## Pull Request Convention

When merging a feature branch into `dev`:

```
Title: feat(connection): complete connection request flow

Description:
- Implements USDm approval check before fee transfer
- Adds confirmation modal with exact fee amount displayed
- Handles insufficient balance with MiniPay add cash deeplink
- Smart contract interaction uses legacy tx + feeCurrency
- Supabase records request only after on-chain tx confirmation

Closes: #[issue number if applicable]
Tested on: Celo Sepolia
Contract: [deployed address if applicable]
```

---

## Tag and Release Convention

When deploying to Celo Mainnet, create a GitHub release tag:

```bash
# Testnet deployment
git tag -a v0.1.0-sepolia -m "CMY v0.1.0 deployed to Celo Sepolia"

# Mainnet deployment
git tag -a v1.0.0 -m "CMY v1.0.0 deployed to Celo Mainnet"

git push origin --tags
```

Semantic versioning:
- `v0.x.x` — testnet / pre-production builds
- `v1.0.0` — first mainnet deployment
- `v1.x.0` — new features post-launch
- `v1.0.x` — bug fixes post-launch
