clea

# SDLC Phase 3 — System Design
## Call Me Yours (CMY)

---

## 1. Introduction

This document defines the full technical architecture of CMY. Every decision here is justified by a requirement from Phase 2. Phase 4 implementation must not deviate from this design without explicit revision of this document first.

---

## 2. Technology Stack

Every choice below is justified by a specific requirement or constraint.

### 2.1 Frontend

| Technology | Version | Justification |
|---|---|---|
| Next.js | 14+ App Router | Celo Composer MiniPay template — server-side rendering improves load time on 3G (NFR-01) |
| TypeScript | Latest | Type safety across contract interactions and wallet calls |
| Tailwind CSS | 3+ | Utility-first, no heavy CSS bundles — critical for lightweight MiniPay browser (NFR-01) |
| shadcn/ui | Latest | Pre-built accessible components, not a full library import — keeps bundle lean |
| Wagmi | v2 | React hooks for wallet connection and contract interaction (FR-01, FR-02) |
| Viem | v2 | First-class CIP-64 transaction support with `feeCurrency` field (NFR-20) |

### 2.2 Smart Contracts

| Technology | Version | Justification |
|---|---|---|
| Solidity | 0.8.28 | Latest stable — built-in overflow protection, custom errors |
| Foundry | Latest | Testing framework — forge tests, cast for deployment (preferred over Hardhat given your background) |
| OpenZeppelin | 5.x | ReentrancyGuard, Ownable — battle-tested security primitives |

### 2.3 Blockchain

| Property | Value | Justification |
|---|---|---|
| Mainnet | Celo (Chain ID: 42220) | MiniPay only runs on Celo (FR constraint) |
| Testnet | Celo Sepolia (Chain ID: 11142220) | Current active L2 testnet — not Alfajores |
| RPC | https://forno.celo.org | Official Celo RPC endpoint |
| Explorer | https://celoscan.io | Contract verification post-deployment |
| Fee Currency | USDm adapter | Users pay gas in USDm — no native CELO required (NFR-20) |
| Transaction Type | Legacy only | EIP-1559 not supported by MiniPay (NFR-20) |

### 2.4 Off-Chain Data Layer

| Technology | Purpose | Justification |
|---|---|---|
| Supabase | Primary database — profiles, matches, sessions, milestones | Postgres with real-time subscriptions — powers live chat session metadata and milestone tracking without touching message content |
| Supabase Storage | Profile photo hosting | S3-compatible, built-in CDN, image transformation API for compression (NFR-02, FR-08) |
| Supabase Auth | Disabled — wallet is identity | No email/password auth needed — wallet address is the user identifier (FR-05) |

### 2.5 Messaging

| Technology | Purpose | Justification |
|---|---|---|
| XMTP Protocol | E2E encrypted chat | Purpose-built decentralized messaging for EVM wallets — messages encrypted with wallet keys, server never sees plaintext (FR-30) |
| XMTP JS SDK | Frontend integration | `@xmtp/xmtp-js` — wallet-to-wallet messaging using existing MiniPay wallet identity |

### 2.6 Development and Tooling

| Tool | Purpose |
|---|---|
| pnpm | Package manager — Celo Composer monorepo default |
| Turborepo | Monorepo build orchestration |
| ngrok | Local testing tunnel — exposes localhost to MiniPay on physical Android device |
| Celoscan API | Contract verification post-deployment |
| Celo Agent Skills | Claude Code context for blockchain interactions |
| Impeccable | Frontend design quality enforcement |

---

## 3. System Architecture

CMY has three distinct layers that interact with each other:

```
┌─────────────────────────────────────────────┐
│           MiniPay Browser (Client)           │
│         Next.js 14 Mini App (Frontend)       │
│  Wagmi + Viem │ XMTP SDK │ Supabase Client   │
└────────┬──────────────┬────────────┬─────────┘
         │              │            │
         ▼              ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Celo        │ │  XMTP        │ │  Supabase    │
│  Mainnet     │ │  Network     │ │  (Postgres + │
│              │ │              │ │   Storage)   │
│  CMY.sol     │ │  E2E Chat    │ │              │
│  Contract    │ │  Nodes       │ │  Profiles    │
│              │ │              │ │  Matches     │
│  Connection  │ │  Messages    │ │  Milestones  │
│  Fees        │ │  (encrypted) │ │  Sessions    │
│  Gifts       │ │              │ │  Photos      │
│  Milestones  │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

**What lives where:**

On-chain (Celo): All economic activity — connection fees, gift transfers, milestone event recording. Immutable, transparent, trustless.

XMTP Network: All message content — fully encrypted, never touches CMY servers, decentralized.

Supabase: All non-economic, non-message data — profiles, match state, session metadata, photo storage, milestone trigger tracking.

---

## 4. Smart Contract Design

### 4.1 Contract Overview

One primary contract handles all on-chain economic activity for CMY.

```
CMY.sol
├── Connection Request Module
├── Gift Transfer Module
├── Milestone Event Module
└── Platform Administration Module
```

### 4.2 Data Structures

```solidity
// Represents a connection request between two users
struct ConnectionRequest {
    address sender;
    address recipient;
    uint256 timestamp;
    bool accepted;
    bool declined;
}

// Represents a gift sent between matched users
struct Gift {
    uint256 giftId;
    address sender;
    address recipient;
    uint256 amount;      // in USDm (18 decimals)
    uint256 timestamp;
    string giftType;     // "heart", "rose", "candy", "star", "ring"
}

// Represents a milestone event recorded on-chain
struct MilestoneEvent {
    bytes32 matchId;     // keccak256(address1, address2)
    string milestoneId;  // "MS-01", "MS-02", etc.
    uint256 timestamp;
    address fulfilledBy; // who sent the gift
}
```

### 4.3 Core Functions

```solidity
// CONNECTION MODULE
function sendConnectionRequest(address recipient) external
// Requires: USDm approval + transfer of CONNECTION_FEE to platform wallet
// Emits: ConnectionRequestSent(sender, recipient, timestamp)
// Enforces: 30-day cooldown on rejected pairs (FR-27)

function acceptRequest(address sender) external
// Creates match, emits MatchCreated event
// Enforces: only recipient can call

function declineRequest(address sender) external
// Records decline, starts 30-day cooldown
// Fee already collected — non-refundable (FR-26)

// GIFT MODULE
function sendGift(
    address recipient,
    string calldata giftType,
    uint256 amount
) external
// Requires: amount >= minimum gift price for giftType
// Transfers: full amount from sender to recipient (FR-48)
// Platform margin: already embedded in frontend price display
// Emits: GiftSent(sender, recipient, giftType, amount, timestamp)

// MILESTONE MODULE
function recordMilestone(
    address matchPartner,
    string calldata milestoneId
) external
// Called by frontend when milestone is fulfilled via gift
// Emits: MilestoneFulfilled(matchId, milestoneId, fulfilledBy, timestamp)

// ADMIN MODULE
function updateConnectionFee(uint256 newFee) external onlyOwner
function updatePlatformWallet(address newWallet) external onlyOwner
function updateMinGiftPrice(
    string calldata giftType,
    uint256 minPrice
) external onlyOwner
```

### 4.4 Security Considerations

| Threat | Mitigation |
|---|---|
| Reentrancy on gift transfer | `ReentrancyGuard` on `sendGift` and `sendConnectionRequest` |
| Unauthorized platform wallet update | `Ownable` — only deployer can update |
| Gift amount below minimum | Require check: `amount >= minGiftPrices[giftType]` |
| Double connection request | Mapping tracks pending requests — revert if one exists |
| Self-connection request | Require: `sender != recipient` |
| Integer overflow | Solidity 0.8.28 — built-in overflow protection |
| Fake milestone recording | Milestone only records if match exists on-chain |

### 4.5 USDm Integration

All economic transactions use USDm ERC-20 token. Users must approve the CMY contract to spend their USDm before any transaction.

```solidity
// USDm contract address on Celo Mainnet
address constant USDM = 0x765DE816845861e75A25fCA122bb6898B8B1282a;

// Fee currency adapter for gas payment
address constant USDM_ADAPTER = 0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B;
```

Frontend approval flow:
```javascript
// Step 1: Approve CMY contract to spend USDm
await usdmContract.approve(CMY_CONTRACT_ADDRESS, amount);

// Step 2: Call contract function with feeCurrency set
await walletClient.writeContract({
    address: CMY_CONTRACT_ADDRESS,
    abi: CMY_ABI,
    functionName: 'sendConnectionRequest',
    args: [recipientAddress],
    feeCurrency: USDM_ADAPTER  // pay gas in USDm
});
```

---

## 5. Database Schema (Supabase)

### 5.1 Tables

**profiles**
```
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
wallet_address  text UNIQUE NOT NULL
display_name    text NOT NULL
age             integer NOT NULL CHECK (age >= 18)
gender          text NOT NULL CHECK (gender IN ('male', 'female'))
seeking         text NOT NULL CHECK (seeking IN ('male', 'female'))
bio             text
photos          text[]        -- array of Supabase Storage URLs
is_active       boolean DEFAULT true
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

**matches**
```
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_a          text NOT NULL REFERENCES profiles(wallet_address)
user_b          text NOT NULL REFERENCES profiles(wallet_address)
matched_at      timestamptz DEFAULT now()
is_active       boolean DEFAULT true
tx_hash         text          -- on-chain match creation tx
```

**connection_requests**
```
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
sender          text NOT NULL REFERENCES profiles(wallet_address)
recipient       text NOT NULL REFERENCES profiles(wallet_address)
status          text DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined'))
fee_tx_hash     text NOT NULL  -- proof of on-chain fee payment
created_at      timestamptz DEFAULT now()
responded_at    timestamptz
```

**chat_sessions**
```
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
match_id        uuid NOT NULL REFERENCES matches(id)
session_date    date NOT NULL
message_count   integer DEFAULT 0   -- count only, no content
created_at      timestamptz DEFAULT now()
```

**milestones**
```
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
match_id        uuid NOT NULL REFERENCES matches(id)
milestone_id    text NOT NULL       -- "MS-01", "MS-02", etc.
triggered_at    timestamptz DEFAULT now()
fulfilled_by    text                -- wallet address of fulfiller
fulfilled_at    timestamptz
gift_tx_hash    text                -- on-chain gift tx if fulfilled
```

**reports**
```
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
reporter        text NOT NULL REFERENCES profiles(wallet_address)
reported        text NOT NULL REFERENCES profiles(wallet_address)
reason          text NOT NULL
created_at      timestamptz DEFAULT now()
resolved        boolean DEFAULT false
```

---

## 6. Frontend Architecture

### 6.1 Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx              # Root layout, MiniPay detection
│   ├── page.tsx                # Entry — redirect to /discover or /onboard
│   ├── onboard/
│   │   └── page.tsx            # Profile creation (FR-06 to FR-12)
│   ├── discover/
│   │   └── page.tsx            # Discovery feed (FR-13 to FR-18)
│   ├── profile/
│   │   └── [address]/page.tsx  # Full profile view
│   ├── requests/
│   │   └── page.tsx            # Incoming connection requests
│   ├── matches/
│   │   └── page.tsx            # All active matches
│   ├── chat/
│   │   └── [matchId]/page.tsx  # XMTP chat (FR-29 to FR-35)
│   ├── gifts/
│   │   └── page.tsx            # Gift catalogue (FR-43 to FR-52)
│   └── dashboard/
│       └── page.tsx            # Milestone tracker
├── components/
│   ├── ProfileCard.tsx
│   ├── GiftCatalogue.tsx
│   ├── MilestoneNotification.tsx
│   ├── ChatWindow.tsx
│   └── ConnectionButton.tsx
├── hooks/
│   ├── useMiniPay.ts           # MiniPay detection + wallet
│   ├── useProfile.ts           # Profile CRUD
│   ├── useMatches.ts           # Match state
│   ├── useMilestones.ts        # Milestone engine
│   └── useXMTP.ts              # XMTP messaging
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── viem.ts                 # Viem wallet client with feeCurrency
│   ├── contracts.ts            # CMY contract ABI + address
│   └── milestoneEngine.ts      # Milestone trigger logic
└── constants/
    ├── gifts.ts                # Gift catalogue definitions
    └── milestones.ts           # Milestone library definitions
```

### 6.2 MiniPay Detection Flow

```
App loads
    │
    ▼
Check window.ethereum.isMiniPay
    │
    ├── FALSE → Show "Open inside MiniPay" error screen
    │
    └── TRUE  → Get wallet address implicitly
                    │
                    ▼
               Check Supabase for existing profile
                    │
                    ├── EXISTS → Route to /discover
                    │
                    └── NOT EXISTS → Route to /onboard
```

### 6.3 Connection Request Flow

```
User taps "Connect" on profile
    │
    ▼
Check USDm balance >= CONNECTION_FEE
    │
    ├── INSUFFICIENT → Deep-link to MiniPay add cash screen
    │                  https://minipay.opera.com/add_cash
    │
    └── SUFFICIENT → Show confirmation modal
                     "Send connection request for X USDm?"
                         │
                         ▼
                     Approve USDm spend (if not already approved)
                         │
                         ▼
                     Call CMY.sendConnectionRequest(recipient)
                     with feeCurrency: USDM_ADAPTER
                         │
                         ├── TX FAILS → Show error, no DB record
                         │
                         └── TX SUCCESS → Record in Supabase
                                          Show success state
```

### 6.4 Gift Send Flow

```
User opens gift catalogue from chat
    │
    ▼
Browse gifts (GF-01 to GF-05)
    │
    ▼
Select gift + confirm amount (>= minimum)
    │
    ▼
Show confirmation: "Send [gift name] worth X USDm?"
    │
    ▼
Approve USDm → Call CMY.sendGift(recipient, giftType, amount)
    │
    ├── TX FAILS → Error, no DB record
    │
    └── TX SUCCESS → Record fulfilled milestone if applicable
                     Show gift in chat thread
                     Notify recipient
```

### 6.5 Milestone Engine Logic

```typescript
// milestoneEngine.ts
// Runs on chat session update — checks all conditions

async function checkMilestones(matchId: string): Promise<Milestone[]> {
    const match = await getMatch(matchId);
    const sessions = await getChatSessions(matchId);
    const existing = await getFulfilledMilestones(matchId);
    const triggered: Milestone[] = [];

    // MS-03: 3 consecutive days
    if (hasConsecutiveDays(sessions, 3) && !exists(existing, 'MS-03')) {
        triggered.push(MILESTONES['MS-03']);
    }

    // MS-04: 7 consecutive days
    if (hasConsecutiveDays(sessions, 7) && !exists(existing, 'MS-04')) {
        triggered.push(MILESTONES['MS-04']);
    }

    // MS-06: 30 days since match
    if (daysSince(match.matched_at) >= 30 && !exists(existing, 'MS-06')) {
        triggered.push(MILESTONES['MS-06']);
    }

    // Rate limit: never trigger same milestone twice
    return triggered.filter(m => !exists(existing, m.id));
}
```

---

## 7. Testing Environment Setup

| Tool | Purpose |
|---|---|
| Celo Sepolia Testnet | Chain ID 11142220 — all contract testing |
| Celo Faucet | https://faucet.celo.org/celo-sepolia — get testnet CELO |
| Mento App | https://app.mento.org — swap testnet CELO for USDm |
| ngrok | Tunnel localhost:3000 to physical Android device for MiniPay testing |
| Foundry forge test | Smart contract unit tests |
| Celoscan Sepolia | https://sepolia.celoscan.io — verify test contracts |

---

## 8. Deployment Architecture

### 8.1 Smart Contract Deployment Order

```
1. Deploy CMY.sol to Celo Sepolia
   forge script script/Deploy.s.sol --network celoSepolia --broadcast

2. Verify on Celoscan Sepolia
   forge verify-contract <address> CMY --chain celo-sepolia

3. Run full Foundry test suite against deployed contract

4. Deploy to Celo Mainnet
   forge script script/Deploy.s.sol --network celo --broadcast

5. Verify on Celoscan Mainnet
```

### 8.2 Frontend Deployment

```
1. Local development
   pnpm dev → localhost:3000

2. Expose for MiniPay testing
   ngrok http 3000 → public URL for MiniPay Developer Mode

3. Production deployment
   Vercel — connect GitHub repo, auto-deploy on main branch push

4. Submit to MiniPay app discovery page
   Register at: https://docs.celo.org/build-on-celo/build-on-minipay/overview
```

---

## 9. CMY Custom Skill (Phase 4 Context Document)

As discussed — before Phase 4 begins, a custom Agent Skill is created to give Claude Code full CMY project context.

```
apps/web/.claude/skills/cmy-context/
├── SKILL.md                    # Activation rules + phase summaries
├── references/
│   ├── phase1-planning.md      # Full Phase 1 document
│   ├── phase2-requirements.md  # Full Phase 2 document
│   └── phase3-design.md        # This document
└── rules/
    └── cmy-rules.md            # Non-negotiables Claude Code must never violate
```

**cmy-rules.md must contain:**
```markdown
# CMY Hard Rules — Never Violate

1. All transactions use legacy type — never EIP-1559
2. All transactions include feeCurrency: USDM_ADAPTER
3. Never display Connect Wallet button inside MiniPay
4. Always check window.ethereum.isMiniPay on app load
5. Gift recipient receives 100% of USDm value — never deduct
6. Connection fee goes to platform wallet — never to recipient
7. All USDm amounts require explicit user confirmation before tx
8. Minimum age 18 enforced at profile creation
9. Profile photos compressed to max 200KB before upload
10. Insufficient balance must deep-link to https://minipay.opera.com/add_cash
11. Messages must use XMTP — never store plaintext on Supabase
12. One profile per wallet address — always check before creating
```

---

## 10. Phase 3 Decision Log

Decisions made in this phase that deviate from or extend Phase 1 and Phase 2:

| Decision | Reason |
|---|---|
| USDm replaces cUSD | MiniPay docs confirm USDm is the current Mento stablecoin — cUSD is deprecated naming |
| XMTP for messaging | Purpose-built wallet-to-wallet E2E encryption — no custom crypto implementation needed |
| Supabase over custom backend | Built-in real-time, storage CDN, Postgres — fastest path to production for V1 |
| Foundry over Hardhat | Your existing tooling preference — no reason to switch for this project |
| Celo Sepolia over Alfajores | Current active L2 testnet per official docs |
| Single CMY.sol contract | V1 scope doesn't justify proxy pattern — simple, auditable, no upgrade complexity |

---

Phase 3 is complete.

**Next step is building the CMY custom skill document before Phase 4 begins. Do you want to build that now, or go straight into Phase 4?**