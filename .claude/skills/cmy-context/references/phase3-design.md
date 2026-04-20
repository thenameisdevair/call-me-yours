# CMY Phase 3 — System Design

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14+ App Router | MiniPay Mini App framework |
| TypeScript | Latest | Type safety |
| Tailwind CSS | 3+ | Lightweight styling |
| shadcn/ui | Latest | Accessible UI components |
| Wagmi | v2 | Wallet hooks |
| Viem | v2 | CIP-64 transactions with feeCurrency |
| XMTP JS SDK | Latest | E2E encrypted messaging |
| Impeccable | Latest | Design quality enforcement |

### Smart Contracts
| Technology | Purpose |
|---|---|
| Solidity 0.8.28 | Contract language |
| Foundry | Testing and deployment |
| OpenZeppelin 5.x | ReentrancyGuard, Ownable |

### Backend
| Technology | Purpose |
|---|---|
| Supabase Postgres | Profiles, matches, sessions, milestones |
| Supabase Storage | Profile photos with CDN |

---

## Network Configuration

| Property | Mainnet | Testnet |
|---|---|---|
| Name | Celo | Celo Sepolia |
| Chain ID | 42220 | 11142220 |
| RPC | https://forno.celo.org | https://forno.celo-sepolia.celo-testnet.org |
| Explorer | https://celoscan.io | https://sepolia.celoscan.io |
| Faucet | N/A | https://faucet.celo.org/celo-sepolia |

**USDm Contract:** `0x765DE816845861e75A25fCA122bb6898B8B1282a`
**USDm Fee Adapter:** `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`

---

## System Architecture

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
│  Connection  │ │  Messages    │ │  Profiles    │
│  Fees        │ │  (encrypted) │ │  Matches     │
│  Gifts       │ │              │ │  Milestones  │
│  Milestones  │ │              │ │  Sessions    │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Smart Contract Design (CMY.sol)

### Data Structures

```solidity
struct ConnectionRequest {
    address sender;
    address recipient;
    uint256 timestamp;
    bool accepted;
    bool declined;
}

struct Gift {
    uint256 giftId;
    address sender;
    address recipient;
    uint256 amount;
    uint256 timestamp;
    string giftType;
}

struct MilestoneEvent {
    bytes32 matchId;
    string milestoneId;
    uint256 timestamp;
    address fulfilledBy;
}
```

### Core Functions

```solidity
// CONNECTION
function sendConnectionRequest(address recipient) external nonReentrant
function acceptRequest(address sender) external
function declineRequest(address sender) external

// GIFTS
function sendGift(
    address recipient,
    string calldata giftType,
    uint256 amount
) external nonReentrant

// MILESTONES
function recordMilestone(
    address matchPartner,
    string calldata milestoneId
) external

// ADMIN
function updateConnectionFee(uint256 newFee) external onlyOwner
function updatePlatformWallet(address newWallet) external onlyOwner
function updateMinGiftPrice(string calldata giftType, uint256 minPrice) external onlyOwner
```

### Custom Errors

```solidity
error SelfConnection();
error RequestAlreadyExists();
error RequestNotFound();
error InsufficientAmount(uint256 provided, uint256 required);
error CooldownActive(uint256 unlocksAt);
error NotMatched();
error AlreadyMatched();
error ProfileNotActive();
```

---

## Database Schema (Supabase)

### profiles
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
wallet_address  text UNIQUE NOT NULL
display_name    text NOT NULL
age             integer NOT NULL CHECK (age >= 18)
gender          text NOT NULL CHECK (gender IN ('male', 'female'))
seeking         text NOT NULL CHECK (seeking IN ('male', 'female'))
bio             text
photos          text[]
is_active       boolean DEFAULT true
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### matches
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_a          text NOT NULL REFERENCES profiles(wallet_address)
user_b          text NOT NULL REFERENCES profiles(wallet_address)
matched_at      timestamptz DEFAULT now()
is_active       boolean DEFAULT true
tx_hash         text
```

### connection_requests
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
sender          text NOT NULL REFERENCES profiles(wallet_address)
recipient       text NOT NULL REFERENCES profiles(wallet_address)
status          text DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined'))
fee_tx_hash     text NOT NULL
created_at      timestamptz DEFAULT now()
responded_at    timestamptz
```

### chat_sessions
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
match_id        uuid NOT NULL REFERENCES matches(id)
session_date    date NOT NULL
message_count   integer DEFAULT 0
created_at      timestamptz DEFAULT now()
```

### milestones
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
match_id        uuid NOT NULL REFERENCES matches(id)
milestone_id    text NOT NULL
triggered_at    timestamptz DEFAULT now()
fulfilled_by    text
fulfilled_at    timestamptz
gift_tx_hash    text
```

### reports
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
reporter        text NOT NULL REFERENCES profiles(wallet_address)
reported        text NOT NULL REFERENCES profiles(wallet_address)
reason          text NOT NULL
created_at      timestamptz DEFAULT now()
resolved        boolean DEFAULT false
```

---

## Key Frontend Flows

### MiniPay Detection Flow
```
App loads
→ Check window.ethereum.isMiniPay
→ FALSE: show "Open inside MiniPay" error
→ TRUE: get wallet address implicitly
  → Check Supabase for existing profile
  → EXISTS: route to /discover
  → NOT EXISTS: route to /onboard
```

### Connection Request Flow
```
User taps Connect
→ Check USDm balance >= CONNECTION_FEE
→ INSUFFICIENT: deep-link to https://minipay.opera.com/add_cash
→ SUFFICIENT: show confirmation modal
  → User confirms
  → Approve USDm spend
  → Call CMY.sendConnectionRequest(recipient) with feeCurrency: USDM_ADAPTER
  → TX FAILS: show error, no DB record
  → TX SUCCESS: record in Supabase, show success
```

### Gift Send Flow
```
User opens gift catalogue from chat
→ Browse GF-01 to GF-05
→ Select gift + confirm amount
→ Show: "Send [gift] worth X USDm?"
→ Approve USDm → Call CMY.sendGift(recipient, giftType, amount)
→ TX FAILS: error, no DB record
→ TX SUCCESS: record milestone if applicable, show gift in chat, notify recipient
```

---

## Milestone Engine

```typescript
async function checkMilestones(matchId: string): Promise<Milestone[]> {
    const match = await getMatch(matchId);
    const sessions = await getChatSessions(matchId);
    const existing = await getFulfilledMilestones(matchId);
    const triggered: Milestone[] = [];

    if (hasConsecutiveDays(sessions, 3) && !exists(existing, 'MS-03'))
        triggered.push(MILESTONES['MS-03']);

    if (hasConsecutiveDays(sessions, 7) && !exists(existing, 'MS-04'))
        triggered.push(MILESTONES['MS-04']);

    if (daysSince(match.matched_at) >= 30 && !exists(existing, 'MS-06'))
        triggered.push(MILESTONES['MS-06']);

    if (daysSince(match.matched_at) >= 90 && !exists(existing, 'MS-07'))
        triggered.push(MILESTONES['MS-07']);

    return triggered.filter(m => !exists(existing, m.id));
}
```

---

## Deployment Order

```bash
# 1. Deploy to Celo Sepolia
forge script script/Deploy.s.sol --network celoSepolia --broadcast

# 2. Verify on Celoscan Sepolia
forge verify-contract <address> CMY --chain celo-sepolia

# 3. Run full test suite
forge test --fork-url https://forno.celo-sepolia.celo-testnet.org -vvv

# 4. Deploy to Celo Mainnet
forge script script/Deploy.s.sol --network celo --broadcast

# 5. Verify on Celoscan Mainnet
forge verify-contract <address> CMY --chain celo

# 6. Deploy frontend to Vercel
# 7. Submit to MiniPay app discovery page
```

---

## Phase 3 Key Decisions

| Decision | Reason |
|---|---|
| USDm replaces cUSD | MiniPay docs confirm USDm is current Mento stablecoin |
| XMTP for messaging | Purpose-built wallet-to-wallet E2E encryption |
| Supabase over custom backend | Built-in realtime, storage, Postgres — fastest V1 path |
| Foundry over Hardhat | Developer's existing tooling preference |
| Celo Sepolia over Alfajores | Current active L2 testnet per official docs |
| Single CMY.sol contract | V1 scope — simple, auditable, no proxy complexity |
