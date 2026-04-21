# Call Me Yours (CMY)

**Dating, re-engineered for real people. Built on MiniPay and Celo.**

Call Me Yours is a dating Mini App distributed exclusively inside the MiniPay wallet. Every user is a phone-verified human with a self-custodial wallet, every connection request costs a small USDm fee to eliminate spam, and every sustained relationship is rewarded through a milestone-driven gifting economy that moves real value, peer to peer, on Celo.

---

## Why this exists

Mainstream dating apps converge on three failure modes: fake profiles, bot-driven spam, and a business model that profits from keeping users single. CMY rejects all three by construction.

| Problem on existing apps | How CMY removes it |
|---|---|
| Fake profiles, catfishing | MiniPay wallets are phone-verified at KYC level. One human, one wallet, one profile. |
| Unlimited free swipes → spam and harassment | Every connection request costs a small USDm fee (initially 0.05 USDm). Spam becomes economically irrational. |
| App monetises loneliness via subscriptions and boosts | No subscription, no pay-to-win. Revenue is a small margin on user-to-user gifts, aligned with real connection. |
| Western-centric, credit-card-gated | Celo + USDm Mento stablecoin work across the Global South with no credit card. Fees are paid in USDm — no need to hold CELO. |

CMY is aimed at existing MiniPay users — roughly 9 million wallet holders, predominantly 18–35, concentrated in emerging markets. The Mini App surface means the entire user journey happens inside a wallet they already trust.

---

## How it works

### 1. Identity — the wallet is the account
There is no username, no password, no email, no KYC form. The MiniPay wallet address *is* the profile identity. The app detects MiniPay via `window.ethereum.isMiniPay`, reads the address implicitly through `eth_requestAccounts`, and never renders a Connect Wallet button. If the app is opened outside MiniPay, a gate blocks access.

### 2. Profile creation
A three-step flow captures display name, age (hard 18+ check), gender, who the user is seeking, a bio, and 1–5 photos. Photos are compressed client-side to ≤200 KB before being uploaded to Supabase Storage. Supabase is the off-chain store for profile data, match state, and chat-session metadata — **not message content**.

### 3. Discovery
A mobile-first feed of profiles filtered by the user's `seeking` preference, excluding their own profile, already-requested profiles, and declined profiles. Tap a card → see the full profile → send a connection request.

### 4. Connection request — the spam filter
Sending a request executes `CMY.sendConnectionRequest(recipient)` on Celo. The fee (initially 0.05 USDm) is transferred to the platform wallet via the smart contract. If the user's balance is insufficient, they are deep-linked to `https://minipay.opera.com/add_cash`. A 30-day cooldown prevents re-requesting after a decline. All transactions are **legacy-type with `feeCurrency: USDM_ADAPTER`** so users pay gas in USDm — they never need CELO.

### 5. Encrypted chat
Once a request is accepted, both parties are matched on-chain (`MatchCreated` event). Chat runs over **XMTP V3 browser SDK** — end-to-end encrypted, message content never touches CMY servers. Supabase stores only `match_id`, `session_date`, and `message_count`.

### 6. Milestones and gifts — where value flows
The milestone engine watches chat-session metadata and triggers named milestones (MS-01 through MS-10: "First conversation", "Seven days strong", "One month together", etc.). When a milestone fires, both users see a celebration UI with a suggested gift from the V1 catalogue:

| Code | Gift | Price |
|---|---|---|
| GF-01 | Warm Heart | 0.50 USDm |
| GF-02 | Red Rose | 1.00 USDm |
| GF-03 | Sweet Candy | 1.50 USDm |
| GF-04 | Gold Star | 2.00 USDm |
| GF-05 | Diamond Ring | 5.00 USDm |

`CMY.sendGift(recipient, giftType, amount)` transfers the full USDm amount directly to the recipient — the platform margin is **never** deducted in the contract. Gifts render as distinct elements inside the chat thread, and completed milestones are recorded on-chain via `recordMilestone`.

---

## Smart contract

- **Network:** Celo Sepolia testnet (chain ID `11142220`)
- **Address:** [`0xB23c099229700693942fdd41B111986879758789`](https://sepolia.celoscan.io/address/0xB23c099229700693942fdd41B111986879758789)
- **Source:** [`apps/contracts/src/CMY.sol`](apps/contracts/src/CMY.sol)
- **Language:** Solidity 0.8.28 — OpenZeppelin 5.x (`ReentrancyGuard`, `Ownable`)
- **Pattern:** All token-moving functions are `nonReentrant`; all admin functions are `onlyOwner`; reverts use custom errors, never strings.

Public entry points:
```
sendConnectionRequest(address recipient)
acceptRequest(address sender) → emits MatchCreated
declineRequest(address sender) → starts 30-day cooldown
sendGift(address recipient, string giftType, uint256 amount)
recordMilestone(address matchPartner, string milestoneId)
```

Admin (owner-only): `updateConnectionFee`, `updatePlatformWallet`, `updateMinGiftPrice`.

Mainnet deployment is gated on completion of Step 10 (full MiniPay device test pass).

---

## Tech stack

### Frontend — `apps/web`
- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + shadcn/ui primitives, Impeccable design system
- **Viem v2** + **Wagmi v2** — all wallet reads/writes
- **@celo/abis** — Celo-specific ABIs
- **@xmtp/browser-sdk** — E2E encrypted chat (XMTP V3; COOP/COEP headers set in `next.config.mjs`)
- **@supabase/supabase-js** — off-chain profile + metadata store
- **browser-image-compression** — client-side photo compression to ≤200 KB

### Smart contracts — `apps/contracts`
- **Foundry** (forge / cast / anvil)
- **OpenZeppelin Contracts 5.x**
- Deployed + verified on **Celo Sepolia**

### Backend
- **Supabase (Postgres)** — profiles, matches, connection_requests, chat_sessions, milestones, reports
- **Supabase Storage** — profile photos (`photos` bucket, public read)
- **Row Level Security** — wallet-scoped JWT claims drive access policy
- **No auth server** — the wallet is the identity; no password, session, or email flow exists

### Infrastructure
- **pnpm** workspaces + **Turborepo**
- **ngrok** for physical-device MiniPay testing
- **Celoscan** contract verification

---

## Project structure

```
call-me-yours/
├── apps/
│   ├── web/                        # Next.js Mini App
│   │   ├── app/                    # App Router routes (layout, page, onboard, discover, ...)
│   │   ├── components/             # MiniPayGate, ProfileCard, GiftCatalogue, ...
│   │   ├── hooks/                  # useMiniPay, useProfile, useMatches, useXMTP, useMilestones
│   │   └── lib/                    # supabase, viem, contracts, milestoneEngine
│   └── contracts/                  # Foundry project
│       ├── src/CMY.sol
│       ├── test/CMY.t.sol
│       └── script/Deploy.s.sol
├── supabase/
│   └── migrations/                 # 001_initial_schema, 002_rls_policies, 003_storage_photos
└── .claude/skills/cmy-context/     # Project context for Claude Code agents
```

---

## Build status

CMY is being built in 11 sequential, committed steps (see `implementation.md`). Current status:

- [x] **Step 1** — Environment configuration, Next.js COOP/COEP headers, Foundry networks
- [x] **Step 2** — `CMY.sol` written, Foundry-tested, deployed + verified on Celo Sepolia
- [x] **Step 3** — Supabase schema, RLS policies, storage bucket
- [x] **Step 4** — MiniPay detection hook, wallet integration, viem clients, contract helpers, root gate, profile routing
- [ ] **Step 5** — Profile creation flow (photo compression, multi-step form)
- [ ] **Step 6** — Discovery feed with filtering and full profile view
- [ ] **Step 7** — Connection request flow (balance check, approval, on-chain fee, Supabase record)
- [ ] **Step 8** — XMTP V3 encrypted chat, match-gated access, session metadata tracking
- [ ] **Step 9** — Milestone engine + gift catalogue
- [ ] **Step 10** — Impeccable design pass, MiniPay compatibility verification, Lighthouse audit
- [ ] **Step 11** — Celo Mainnet contract deploy + Vercel production deploy + MiniPay discovery page submission

---

## Running locally

### Prerequisites
- Node.js 20+
- pnpm 8+ (`corepack enable && corepack prepare pnpm@8.15.6 --activate`)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- A Supabase project (free tier is enough)
- An Android device with MiniPay installed (for device testing)

### Install
```bash
git clone https://github.com/thenameisdevair/call-me-yours.git
cd call-me-yours
pnpm install
```

### Environment
Create `apps/web/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_CMY_CONTRACT_ADDRESS=0xB23c099229700693942fdd41B111986879758789
NEXT_PUBLIC_CELO_RPC=https://forno.celo.org
NEXT_PUBLIC_USDM_ADDRESS=0x765DE816845861e75A25fCA122bb6898B8B1282a
NEXT_PUBLIC_USDM_ADAPTER=0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B
NEXT_PUBLIC_XMTP_ENV=dev
```

Apply Supabase migrations from `supabase/migrations/` (via the Supabase CLI or dashboard SQL editor).

### Dev server
```bash
pnpm --filter web dev
```

Next.js starts on `http://localhost:3000`. Because CMY requires `window.ethereum.isMiniPay`, loading the dev server in a regular desktop browser will show the "Please open inside MiniPay" gate — this is correct behaviour. To test end-to-end:

```bash
ngrok http 3000
```

Open the ngrok HTTPS URL in MiniPay Developer Mode on Android.

### Contracts
```bash
cd apps/contracts
forge install
forge test -vvv
# Deploy to Sepolia:
forge script script/Deploy.s.sol \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org \
  --broadcast --verify \
  --etherscan-api-key $CELOSCAN_API_KEY
```

### Type-check
```bash
pnpm --filter web type-check
```

---

## Screenshots

> _Added as each UI step lands. Reserved slots:_

| View | Screenshot |
|---|---|
| MiniPay gate | _pending Step 10_ |
| Onboarding — profile creation | _pending Step 5_ |
| Discovery feed | _pending Step 6_ |
| Profile view + Connect | _pending Step 6_ |
| Request confirmation modal | _pending Step 7_ |
| XMTP chat thread | _pending Step 8_ |
| Milestone celebration | _pending Step 9_ |
| Gift catalogue | _pending Step 9_ |

---

## Design principles

1. **The wallet is the user.** No auth screens. No connect button. No email.
2. **Every transaction is legacy-type + `feeCurrency: USDM_ADAPTER`.** Users never need CELO.
3. **The contract never deducts a platform cut from gifts.** Full amount goes to the recipient.
4. **Message content never reaches our infrastructure.** XMTP handles it, end-to-end.
5. **Photos compress to ≤200 KB before upload.** The Global South is bandwidth-constrained by default.
6. **Mobile-first, 360 px minimum.** No desktop-first layouts, no hover-dependent UX.
7. **No blockchain aesthetic.** Warm serifs (DM Serif Display), Plus Jakarta Sans body, intimate tones — not neon-on-dark.

---

## Links

- **Contract on Celo Sepolia:** https://sepolia.celoscan.io/address/0xB23c099229700693942fdd41B111986879758789
- **GitHub:** https://github.com/thenameisdevair/call-me-yours
- **MiniPay:** https://www.opera.com/products/minipay
- **Celo:** https://celo.org
- **XMTP:** https://xmtp.org
- **Mento (USDm):** https://www.mento.org

---

## License

Source-available, pre-launch. Final license TBD at V1 public release.
