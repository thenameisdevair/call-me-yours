# CMY Hard Rules — Never Violate

These are non-negotiable constraints derived from MiniPay platform requirements,
Celo blockchain constraints, product decisions, and security requirements.
Violating any of these rules will produce a broken, insecure, or rejected app.

---

## 1. MiniPay Platform Rules

### RULE-01: Always detect MiniPay on app load
Every page entry must check `window.ethereum.isMiniPay` before any wallet
interaction. If false, render an error screen — do not proceed.

```typescript
// CORRECT
useEffect(() => {
  if (!window.ethereum || !window.ethereum.isMiniPay) {
    setError("Please open Call Me Yours inside MiniPay.");
    return;
  }
  // proceed
}, []);

// WRONG — never assume MiniPay context
const address = await window.ethereum.request({ method: 'eth_requestAccounts' });
```

### RULE-02: Never display a Connect Wallet button inside MiniPay
Wallet connection is implicit in MiniPay. A connect button will confuse users
and break the UX. Always hide it when `window.ethereum.isMiniPay` is true.

```typescript
// CORRECT
const [hideConnect, setHideConnect] = useState(false);
useEffect(() => {
  if (window.ethereum?.isMiniPay) setHideConnect(true);
}, []);
return <>{!hideConnect && <ConnectButton />}</>;

// WRONG
return <ConnectButton />; // always shown
```

### RULE-03: Legacy transactions only — never EIP-1559
MiniPay does not support EIP-1559. Never set `maxFeePerGas` or
`maxPriorityFeePerGas`. Always use legacy `gasPrice`.

```typescript
// CORRECT — legacy transaction
await walletClient.sendTransaction({
  to: address,
  value: amount,
  gasPrice: parseGwei('1'),
  feeCurrency: USDM_ADAPTER,
});

// WRONG — EIP-1559
await walletClient.sendTransaction({
  maxFeePerGas: parseGwei('2'),      // NOT SUPPORTED
  maxPriorityFeePerGas: parseGwei('1'), // NOT SUPPORTED
});
```

### RULE-04: Always set feeCurrency to USDM_ADAPTER
Every transaction sent from CMY must include the feeCurrency field so users
pay gas in USDm — never requiring them to hold native CELO.

```typescript
// CORRECT
const hash = await walletClient.writeContract({
  address: CMY_CONTRACT_ADDRESS,
  abi: CMY_ABI,
  functionName: 'sendConnectionRequest',
  args: [recipientAddress],
  feeCurrency: USDM_ADAPTER, // "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B"
});

// WRONG — no feeCurrency
const hash = await walletClient.writeContract({
  address: CMY_CONTRACT_ADDRESS,
  abi: CMY_ABI,
  functionName: 'sendConnectionRequest',
  args: [recipientAddress],
  // missing feeCurrency — user needs CELO for gas
});
```

### RULE-05: Insufficient balance must deep-link to MiniPay add cash screen
Never show a dead-end error when a user has insufficient USDm. Always
redirect them to top up.

```typescript
// CORRECT
if (balance < CONNECTION_FEE) {
  window.location.href = "https://minipay.opera.com/add_cash";
  return;
}

// WRONG
if (balance < CONNECTION_FEE) {
  setError("Insufficient balance."); // dead end — user doesn't know what to do
}
```

---

## 2. Economic Rules

### RULE-06: Gift recipient receives 100% of USDm value — never deduct
The smart contract must transfer the full gift amount from sender directly to
recipient. Platform margin is embedded in the frontend price display only.

```solidity
// CORRECT — full amount to recipient
IERC20(USDM).transferFrom(msg.sender, recipient, amount);

// WRONG — platform takes cut at transfer time
uint256 fee = amount * platformFee / 100;
IERC20(USDM).transferFrom(msg.sender, recipient, amount - fee); // violates product spec
IERC20(USDM).transferFrom(msg.sender, platformWallet, fee);
```

### RULE-07: Connection fees go to platform wallet — never to recipient
Connection request fees are the platform's primary revenue stream. They must
route to the designated platform wallet address on-chain.

```solidity
// CORRECT
IERC20(USDM).transferFrom(msg.sender, platformWallet, CONNECTION_FEE);

// WRONG
IERC20(USDM).transferFrom(msg.sender, recipient, CONNECTION_FEE); // recipient gets fee
```

### RULE-08: All USDm transactions require explicit user confirmation
Never execute a USDm transfer without showing the user a confirmation step
displaying the exact amount. No silent payments.

```typescript
// CORRECT
setShowConfirmation(true);
// User sees: "Send connection request for 0.05 USDm?"
// User taps confirm → then execute

// WRONG
await sendConnectionRequest(recipient); // fires immediately on tap
```

### RULE-09: USDm approval must precede every contract interaction
The CMY contract cannot spend user USDm without prior approval. Always check
allowance and request approval before calling contract functions.

```typescript
// CORRECT
const allowance = await usdmContract.read.allowance([userAddress, CMY_CONTRACT]);
if (allowance < amount) {
  await usdmContract.write.approve([CMY_CONTRACT, amount]);
}
await cmyContract.write.sendConnectionRequest([recipient]);

// WRONG
await cmyContract.write.sendConnectionRequest([recipient]); // will revert — no approval
```

---

## 3. Identity and Profile Rules

### RULE-10: One profile per wallet address — always check before creating
Before rendering the onboarding flow, always query Supabase for an existing
profile with the user's wallet address. Never allow duplicates.

```typescript
// CORRECT
const { data: existing } = await supabase
  .from('profiles')
  .select('id')
  .eq('wallet_address', address)
  .single();

if (existing) router.push('/discover');
else router.push('/onboard');

// WRONG
router.push('/onboard'); // always shows onboard — creates duplicates
```

### RULE-11: Minimum age 18 — enforce at profile creation
Block profile creation if age input is below 18. Display a clear message.
Never store a profile with age < 18.

```typescript
// CORRECT
if (age < 18) {
  setError("You must be 18 or older to use Call Me Yours.");
  return;
}

// WRONG
await createProfile({ age }); // no age validation
```

### RULE-12: Profile photos must be compressed before upload
Never upload raw photos. Always compress to max 200KB before sending to
Supabase Storage. Use browser-image-compression or sharp.

```typescript
// CORRECT
import imageCompression from 'browser-image-compression';
const compressed = await imageCompression(file, {
  maxSizeMB: 0.2,     // 200KB
  maxWidthOrHeight: 800,
});
await supabase.storage.from('photos').upload(path, compressed);

// WRONG
await supabase.storage.from('photos').upload(path, file); // raw file — too heavy
```

---

## 4. Privacy Rules

### RULE-13: Never store message content in Supabase
All chat messages must go through XMTP. Supabase only stores session metadata
(date, message count). Never store plaintext or encrypted message content in
the database.

```typescript
// CORRECT — metadata only
await supabase.from('chat_sessions').upsert({
  match_id: matchId,
  session_date: today,
  message_count: supabase.rpc('increment', { x: 1 }),
});
// Message itself goes to XMTP

// WRONG
await supabase.from('messages').insert({
  match_id: matchId,
  content: message, // NEVER store message content
  sender: address,
});
```

### RULE-14: Never expose wallet addresses publicly in UI without consent
Wallet addresses are identity. Never render them in discovery feeds or public
profile pages. Use display names only in public-facing views.

---

## 5. Smart Contract Rules

### RULE-15: ReentrancyGuard on all functions that transfer USDm
Any function that calls `IERC20.transferFrom` or `IERC20.transfer` must use
the `nonReentrant` modifier from OpenZeppelin.

```solidity
// CORRECT
function sendGift(address recipient, string calldata giftType, uint256 amount)
    external
    nonReentrant  // required
{
    IERC20(USDM).transferFrom(msg.sender, recipient, amount);
}

// WRONG — vulnerable to reentrancy
function sendGift(address recipient, uint256 amount) external {
    IERC20(USDM).transferFrom(msg.sender, recipient, amount); // no guard
}
```

### RULE-16: Use custom errors — never revert with strings
Custom errors save gas and are more informative. Never use
`require(condition, "string")` — use `if (!condition) revert CustomError()`.

```solidity
// CORRECT
error InsufficientAmount(uint256 provided, uint256 required);
error SelfConnection();
error RequestAlreadyExists();

if (msg.sender == recipient) revert SelfConnection();
if (amount < minGiftPrices[giftType]) revert InsufficientAmount(amount, minGiftPrices[giftType]);

// WRONG
require(msg.sender != recipient, "Cannot connect to yourself");
require(amount >= minPrice, "Amount too low");
```

### RULE-17: Never store unbounded arrays on-chain
All on-chain data structures must be gas-optimized. Use mappings over arrays
wherever possible. Never push to arrays without a size limit.

```solidity
// CORRECT
mapping(address => mapping(address => ConnectionRequest)) public requests;
mapping(bytes32 => Gift[]) public matchGifts; // bounded by match context

// WRONG
Gift[] public allGifts; // unbounded — will grow forever, expensive to iterate
```

### RULE-18: Only owner can update platform wallet and fee parameters

```solidity
// CORRECT
function updatePlatformWallet(address newWallet) external onlyOwner {
    platformWallet = newWallet;
}

// WRONG — no access control
function updatePlatformWallet(address newWallet) external {
    platformWallet = newWallet; // anyone can drain platform fees
}
```

---

## 6. Testing Rules

### RULE-19: All contracts must pass Foundry tests before deployment
Never deploy to Celo Sepolia or Mainnet without a passing test suite.
Minimum test coverage required:
- Connection request fee transfer
- Gift transfer (full amount to recipient)
- Reentrancy attack on gift transfer
- Unauthorized platform wallet update
- Self-connection request revert
- Insufficient gift amount revert
- 30-day cooldown enforcement

### RULE-20: Test against Celo Sepolia — not Hardhat local fork
MiniPay-specific behavior (feeCurrency, legacy transactions) must be tested
on actual Celo Sepolia network, not a local fork.

```bash
# CORRECT — test on Celo Sepolia
forge test --fork-url https://forno.celo-sepolia.celo-testnet.org -vvv

# ACCEPTABLE for unit logic only
forge test -vvv

# WRONG for integration tests
forge test --fork-url http://localhost:8545 # local anvil fork misses Celo specifics
```
