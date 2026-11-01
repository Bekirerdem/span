# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Span holds a holding deposit between two people who haven't met. The host locks a bond equal to the deposit; the guest pays the deposit; whoever walks away pays (civil-law arrhes rule). No owner, no admin, no fees. Pull payments.

Frontend: tiny router in `src/App.tsx` (`/` scroll-driven workshop board in `src/board/`, `/new` open a Span, `/s/:id` one Span in `src/app/`). Contract ABI and network switch live in `src/span/`. The app runs on Arc mainnet by default; set `VITE_SPAN_NETWORK=testnet` in `.env` to use the testnet deployment (currently NOT set). Reads go through a fallback transport (same-origin `/rpc` relay in `functions/rpc.ts` when hosted, then public Arc RPCs).

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## Share links

- Starter apps already ship `getShareBase`, `buildShareLink` and `installShareSync` in `src/lib/share.ts`; import them instead of rewriting them.
- Keep shareable state in the URL path or query, not in the `#fragment`.
- Never put a secret (private key, claim secret, seed phrase, session token, API key) in the URL path or query, encoded or not: every in-app path and query is mirrored to the visitor's studio.arc.io address bar and browser history and reaches servers. A bearer claim secret goes only in the `#fragment` appended to the share link (`` `${await buildShareLink('/claim')}#${secret}` ``) and is read from `location.hash` on load. A link to the app's own share URL shown inside the app must be copy-only or open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Build every link a user copies or sends with `buildShareLink()` from `src/lib/share.ts`.
- Keep the `installShareSync()` call in `src/main.tsx` when editing it; it keeps the Studio address bar in step with in-app navigation.
- Navigate inside the app with relative links.

## To Run

```bash
bun install
bun run dev
```

## Span contract (deployed)

- `contracts/Span.sol`: immutable two-sided USDC holding-deposit escrow (host bond + guest deposit, pull-payment credits, no owner/fees/arbiter). Tests: `contracts/test/Span.t.sol` (66 passing).
- Arc Testnet: `0xacf81a650c5b2741e280e666ef9ee9666ad131e8` (tx `0x33bac5e9bf56014dea3d67fca62dd6123d511b49a399d2679059702d77ee378a`), constructor arg = USDC ERC-20 `0x3600000000000000000000000000000000000000`.
- Frontend not built yet. Amounts are raw 6-decimal USDC; `deal.amount` is both the deposit and the bond.

## Mainnet deployment (Arc, chain 5042)

- Span: `0x17126d2F33C988fcF11952423d4585Bf94b1Cf67`, constructor arg USDC `0x3600000000000000000000000000000000000000`.
- Deploy tx `0x09502686485bd5abb320ae1a8a18b6533c3ef45a62063e1370d6961d9ca55d63`, block 29037949, deployer `0x39AEfbC8388da12907A21d9De888B288a9fa5794` (the user's own wallet).
- Deployed by the user from their own wallet using the exact bytecode in `contracts/out/Span.sol/Span.json` (solc 0.8.28, 66/66 tests), because creating a Circle API key failed on Circle's side. Arc Studio did not deploy to or transact on mainnet.
- Read-only check: `usdc()` returns the USDC address, `nextId()` is 1, and the runtime bytecode equals the compiled `deployedBytecode` byte for byte except the four immutable `usdc` slots (which hold the USDC address).
- Testnet deployment (still valid): `0xacf81a650c5b2741e280e666ef9ee9666ad131e8`, tx `0x33bac5e9bf56014dea3d67fca62dd6123d511b49a399d2679059702d77ee378a`.
- No owner, admin key, pause, upgrade path or fee.
