---
name: cmy-context
description: Full project context for Call Me Yours (CMY) — a dating Mini App built
  on MiniPay and Celo blockchain. Use this skill when building any CMY feature,
  smart contract, UI component, API route, database schema, or when asked about
  project requirements, architecture, constraints, commit conventions, or branching
  strategy. Activate automatically when working inside the Call Me Yours project.
---

# Call Me Yours (CMY) — Project Skill

## What This Project Is

Call Me Yours (CMY) is a dating Mini App built exclusively for existing MiniPay
wallet users, discoverable through the MiniPay app discovery page. It leverages
MiniPay's phone-verified wallet identity to eliminate fake profiles, uses
micro-payment friction to eliminate spam and bots, and introduces a
milestone-driven gifting economy where real sustained connection is rewarded
through user-to-user USDm gift transfers on Celo mainnet.

**Short identifier:** CMY
**Blockchain:** Celo Mainnet (Chain ID: 42220)
**Testnet:** Celo Sepolia (Chain ID: 11142220)
**Primary currency:** USDm (Mento stablecoin)
**Platform:** MiniPay Mini App (Next.js, runs inside MiniPay browser)
**Target users:** Existing MiniPay wallet holders, ages 18-35, Global South

---

## Quick Reference — Critical Constants

```typescript
// Network
CELO_MAINNET_CHAIN_ID = 42220
CELO_SEPOLIA_CHAIN_ID = 11142220
CELO_RPC = "https://forno.celo.org"
CELO_SEPOLIA_RPC = "https://forno.celo-sepolia.celo-testnet.org"

// Tokens
USDM_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a"
USDM_ADAPTER = "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B"

// MiniPay
MINIPAY_DETECTION = window.ethereum.isMiniPay
MINIPAY_ADD_CASH_DEEPLINK = "https://minipay.opera.com/add_cash"

// Explorers
CELOSCAN_MAINNET = "https://celoscan.io"
CELOSCAN_SEPOLIA = "https://sepolia.celoscan.io"
```

---

## Technology Stack

### Frontend
- **Framework:** Next.js 14+ with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Wallet:** Wagmi v2 + Viem v2
- **Messaging:** XMTP JS SDK (@xmtp/xmtp-js)
- **Design skill:** Impeccable (pbakaus/impeccable)

### Smart Contracts
- **Language:** Solidity 0.8.28
- **Framework:** Foundry (forge, cast, anvil)
- **Libraries:** OpenZeppelin 5.x (ReentrancyGuard, Ownable)

### Backend / Database
- **Database:** Supabase (Postgres)
- **Storage:** Supabase Storage (profile photos)
- **Auth:** None — wallet address is the sole identity

### Tooling
- **Package manager:** pnpm
- **Monorepo:** Turborepo
- **Local tunnel:** ngrok (expose localhost to MiniPay on Android)
- **Version control:** Git + GitHub (thenameisdevair/call-me-yours)

---

## Project Structure

```
call-me-yours/
├── apps/
│   ├── web/                          # Next.js Mini App
│   │   ├── app/
│   │   │   ├── layout.tsx            # Root layout, MiniPay detection
│   │   │   ├── page.tsx              # Entry — redirect logic
│   │   │   ├── onboard/page.tsx      # Profile creation
│   │   │   ├── discover/page.tsx     # Discovery feed
│   │   │   ├── profile/[address]/    # Full profile view
│   │   │   ├── requests/page.tsx     # Incoming connection requests
│   │   │   ├── matches/page.tsx      # Active matches list
│   │   │   ├── chat/[matchId]/       # XMTP encrypted chat
│   │   │   ├── gifts/page.tsx        # Gift catalogue
│   │   │   └── dashboard/page.tsx    # Milestone tracker
│   │   ├── components/
│   │   │   ├── ProfileCard.tsx
│   │   │   ├── GiftCatalogue.tsx
│   │   │   ├── MilestoneNotification.tsx
│   │   │   ├── ChatWindow.tsx
│   │   │   └── ConnectionButton.tsx
│   │   ├── hooks/
│   │   │   ├── useMiniPay.ts         # MiniPay detection + wallet
│   │   │   ├── useProfile.ts         # Profile CRUD
│   │   │   ├── useMatches.ts         # Match state
│   │   │   ├── useMilestones.ts      # Milestone engine
│   │   │   └── useXMTP.ts            # XMTP messaging
│   │   ├── lib/
│   │   │   ├── supabase.ts           # Supabase client
│   │   │   ├── viem.ts               # Viem wallet client
│   │   │   ├── contracts.ts          # CMY ABI + address
│   │   │   └── milestoneEngine.ts    # Milestone trigger logic
│   │   └── constants/
│   │       ├── gifts.ts              # Gift catalogue
│   │       └── milestones.ts         # Milestone library
│   └── contracts/                    # Foundry smart contracts
│       ├── src/
│       │   └── CMY.sol               # Main contract
│       ├── test/
│       │   └── CMY.t.sol             # Foundry tests
│       └── script/
│           └── Deploy.s.sol          # Deployment script
├── .claude/
│   └── skills/
│       └── cmy-context/              # This skill
└── .github/
    └── workflows/                    # CI/CD (future)
```

---

## Detailed references, rules, and workflows are in:

- `references/phase1-planning.md` — Project scope, goals, risk register
- `references/phase2-requirements.md` — All functional and non-functional requirements
- `references/phase3-design.md` — Full system architecture and smart contract design
- `rules/cmy-rules.md` — Hard constraints that must never be violated
- `rules/git-conventions.md` — Branching strategy and commit conventions
