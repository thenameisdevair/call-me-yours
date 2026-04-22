# Call Me Yours (CMY)

**Dating, re-engineered for real people. Built on MiniPay and Celo.**

A phone-verified, spam-proof dating Mini App with end-to-end encrypted chat and on-chain milestone gifting — distributed exclusively inside the MiniPay wallet.

**Live app:** https://call-me-yours-web-kqmg.vercel.app

---

## The problem

Mainstream dating apps in the Global South converge on three failure modes:

- **Fake profiles and catfishing.** Email signup lets one person run ten accounts. Photo verification is optional, bypassable, and after-the-fact.
- **Bot-driven spam and harassment.** Unlimited free swipes mean every woman on a popular app receives hundreds of drive-by messages a day; most give up.
- **A business model that profits from loneliness.** Subscriptions and paid boosts reward keeping users single. Western payment rails (credit cards) gate access for most users in emerging markets anyway.

The result: users in Kenya, Nigeria, the Philippines, and across the Global South pay for a product that actively works against them.

## How CMY solves it

| Problem | CMY's fix |
|---|---|
| Fake profiles | MiniPay wallets are phone-verified at KYC level. One human, one wallet, one profile — enforced by construction, not moderation. |
| Spam and harassment | Every connection request costs a small USDm fee (initially 0.05 USDm). Spam becomes economically irrational; genuine interest survives. |
| Loneliness-as-business-model | No subscription, no boosts, no pay-to-win. Revenue is a thin margin on user-to-user gifts — aligned with real connection, not retention. |
| Credit-card-gated Western rails | Celo + USDm Mento stablecoin work across the Global South. All fees paid in USDm — users never need to hold CELO or understand gas. |

CMY targets the ~9 million existing MiniPay users, predominantly 18–35, concentrated in emerging markets. The Mini App surface means the entire journey happens inside a wallet they already trust.

---

## Key features

- **Phone-verified identity** — `window.ethereum.isMiniPay` detection on every page entry. No email, no password, no Connect Wallet button. Ever.
- **Paid connection requests** — `CMY.sendConnectionRequest(recipient)` transfers a small USDm fee on-chain. 30-day cooldown after a decline prevents re-requests.
- **End-to-end encrypted chat** — XMTP V3 browser SDK. Message content never touches CMY infrastructure. Chat is gated by on-chain match state.
- **Milestone engine** — Ten named milestones (first message, seven days strong, one month together, etc.) fire on sustained engagement and surface a celebration UI with a suggested gift.
- **Peer-to-peer gifting economy** — Five-tier catalogue (0.50 → 5.00 USDm). `CMY.sendGift` transfers the **full** amount to the recipient; the platform margin is never deducted in the contract.
- **USDm-paid gas** — Every write is a legacy-type transaction with `feeCurrency: USDM_ADAPTER`. Users never need CELO.
- **Bandwidth-respectful** — Photos compressed client-side to ≤200 KB before upload. Discovery feed paginates at 20 profiles per page. Mobile-first, 360 px minimum.
- **No blockchain aesthetic** — DM Serif Display + Plus Jakarta Sans, warm tones, intimate UI. It feels like a dating app, not a DEX.

---

## Tech stack

| Layer | Stack |
|---|---|
| **Frontend** | Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui |
| **Wallet / chain** | Viem v2 · Wagmi v2 · `@celo/abis` · MiniPay (`window.ethereum.isMiniPay`) |
| **Smart contracts** | Solidity 0.8.28 · Foundry · OpenZeppelin 5.x (`ReentrancyGuard`, `Ownable`) |
| **Blockchain** | Celo Mainnet (chain ID 42220) · USDm Mento stablecoin |
| **Messaging** | XMTP V3 (`@xmtp/browser-sdk`) — end-to-end encrypted |
| **Database** | Supabase (Postgres) with wallet-scoped Row Level Security |
| **Storage** | Supabase Storage — profile photos bucket, public read |
| **Tooling** | pnpm workspaces · Turborepo · ngrok · Celoscan verification |
| **Hosting** | Vercel (frontend) · Celo Mainnet (contracts) |

---

## Smart contracts

The `CMY` contract handles all on-chain state: paid connection requests, matches, milestones, and gifts. All token-moving functions are `nonReentrant`; all admin functions are `onlyOwner`; reverts use custom errors.

| Network | Address | Explorer |
|---|---|---|
| **Celo Mainnet** (chain ID 42220) | `0xb23c099229700693942fdd41b111986879758789` | [View on Celoscan](https://celoscan.io/address/0xb23c099229700693942fdd41b111986879758789) |
| **Celo Sepolia** (chain ID 11142220) | `0xB23c099229700693942fdd41B111986879758789` | [View on Sepolia Celoscan](https://sepolia.celoscan.io/address/0xB23c099229700693942fdd41B111986879758789) |

Source: [apps/contracts/src/CMY.sol](apps/contracts/src/CMY.sol)

Public entry points:

```solidity
sendConnectionRequest(address recipient)
acceptRequest(address sender)            // emits MatchCreated
declineRequest(address sender)           // starts 30-day cooldown
sendGift(address recipient, string giftType, uint256 amount)
recordMilestone(address matchPartner, string milestoneId)
```

Admin (owner-only): `updateConnectionFee`, `updatePlatformWallet`, `updateMinGiftPrice`.

---

## Running locally

### Prerequisites

- Node.js 20+
- pnpm 8+ (`corepack enable && corepack prepare pnpm@8.15.6 --activate`)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- A Supabase project (free tier is sufficient)
- An Android device with MiniPay installed (for end-to-end device testing)

### 1. Clone and install

```bash
git clone https://github.com/thenameisdevair/call-me-yours.git
cd call-me-yours
pnpm install
```

### 2. Configure environment

Create `apps/web/.env.local` and provide values for each variable listed in [Environment variables](#environment-variables).

Apply the Supabase migrations in `supabase/migrations/` via the Supabase CLI or the dashboard SQL editor.

### 3. Start the dev server

```bash
pnpm --filter web dev
```

Next.js starts on `http://localhost:3000`. CMY requires `window.ethereum.isMiniPay`, so loading the dev server in a desktop browser will show the "Please open inside MiniPay" gate — that is correct. To test the real flow, expose localhost and open it inside MiniPay:

```bash
ngrok http 3000
# Open the ngrok HTTPS URL in MiniPay Developer Mode on Android.
```

### 4. Contracts (optional)

```bash
cd apps/contracts
forge install
forge test -vvv
```

Deploy to Celo Sepolia:

```bash
forge script script/Deploy.s.sol \
  --rpc-url https://forno.celo-sepolia.celo-testnet.org \
  --broadcast --verify \
  --etherscan-api-key $CELOSCAN_API_KEY
```

### 5. Type-check

```bash
pnpm --filter web type-check
```

---

## Environment variables

Frontend (`apps/web/.env.local`) — names only, supply your own values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CMY_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_CELO_RPC`
- `NEXT_PUBLIC_USDM_ADDRESS`
- `NEXT_PUBLIC_USDM_ADAPTER`
- `NEXT_PUBLIC_XMTP_ENV`

Contracts (`apps/contracts/.env`) — names only, supply your own values:

- `PRIVATE_KEY`
- `CELOSCAN_API_KEY`

**Never commit `.env.local` or `.env` files.** Both are in `.gitignore`.

---

## Project structure

```
call-me-yours/
├── apps/
│   ├── web/                          # Next.js Mini App
│   │   ├── app/                      # App Router: layout, onboard, discover, profile, requests, matches, chat
│   │   ├── components/               # MiniPayGate, ProfileCard, GiftCatalogue, ConnectionButton, ...
│   │   ├── hooks/                    # useMiniPay, useProfile, useMatches, useXMTP, useMilestones, ...
│   │   ├── lib/                      # supabase, viem, contracts, milestoneEngine
│   │   ├── constants/                # gifts catalogue, milestone library
│   │   └── next.config.mjs           # COOP/COEP headers for XMTP
│   └── contracts/                    # Foundry project
│       ├── src/CMY.sol               # Main contract
│       ├── test/CMY.t.sol            # Foundry tests
│       └── script/Deploy.s.sol       # Network-aware deployer
├── supabase/
│   └── migrations/                   # Schema, RLS policies, storage bucket
└── .claude/skills/cmy-context/       # Project context for AI coding agents
```

---

## Contributing

Contributions are welcome — bug reports, feature proposals, and PRs alike.

1. **Open an issue first** for anything larger than a typo or minor bug fix. It lets us align on scope before you spend time.
2. **Fork and branch.** Use `feat/<short-slug>`, `fix/<short-slug>`, or `docs/<short-slug>`.
3. **Match the house style.** TypeScript strict, no `any`, no unused imports. Solidity uses custom errors (never `require` strings). Run `pnpm --filter web type-check` and `forge test` before pushing.
4. **Conventional commits.** `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`. Keep subjects under 72 chars.
5. **Never commit secrets.** `.env*` files, private keys, API keys, or Supabase service-role keys must never enter the repo. PRs containing them will be rejected and the key rotated.
6. **Respect the hard rules.** Every transaction must be legacy-type with `feeCurrency: USDM_ADAPTER`. No Connect Wallet button, ever. Message content must never reach CMY infrastructure. See `.claude/skills/cmy-context/rules/` for the full list.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Links

- **Live app:** https://call-me-yours-web-kqmg.vercel.app
- **GitHub:** https://github.com/thenameisdevair/call-me-yours
- **MiniPay:** https://www.opera.com/products/minipay
- **Celo:** https://celo.org
- **XMTP:** https://xmtp.org
- **Mento (USDm):** https://www.mento.org
