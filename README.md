# Span

Span holds a holding deposit between two people who haven't met, such as a landlord and a prospective tenant, or a seller and a buyer. The host locks a bond equal to the deposit, the guest pays the deposit, and whoever walks away pays. This is the civil-law "arrhes" (earnest money) rule, enforced by a contract instead of trust.

There is no owner, no admin key, no pause, no upgrade path and no fee. Nobody, including the authors, can move the money outside the rules below. Payouts are credited to each party and withdrawn by them, so a blocked or unresponsive counterparty can never lock the other side's funds.

Built with [Arc Studio](https://studio.arc.io)

## The rules

| What happens | Host gets | Guest gets |
| --- | --- | --- |
| Guest walks away before the viewing | deposit + own bond back | nothing |
| Host walks away | nothing | deposit + host bond (double) |
| Guest confirms at handover | deposit + bond back | nothing |
| Nobody objects within 24 hours after the viewing | deposit + bond back (anyone can release) | nothing |
| Guest disputes within that 24 hours, and both propose the same split | bond + the rest of the deposit | the agreed share of the deposit |
| Still disputed 7 days after the 24 hour window | bond back | deposit back |

There is no arbiter. A cancelled Span, before any guest has paid, returns the bond to the host.

## Deployments

| Network | Address | Notes |
| --- | --- | --- |
| Arc mainnet (chain 5042) | `0x17126d2F33C988fcF11952423d4585Bf94b1Cf67` | Deployed by `0x39AEfbC8388da12907A21d9De888B288a9fa5794` from their own wallet, tx `0x09502686485bd5abb320ae1a8a18b6533c3ef45a62063e1370d6961d9ca55d63`, block 29037949 |
| Arc Testnet (chain 5042002) | `0xacf81a650c5b2741e280e666ef9ee9666ad131e8` | Deployed with Arc Studio, tx `0x33bac5e9bf56014dea3d67fca62dd6123d511b49a399d2679059702d77ee378a` |

Both use USDC `0x3600000000000000000000000000000000000000` (6 decimals) as the token.

The mainnet contract was deployed with the exact bytecode compiled from `contracts/Span.sol` (solc 0.8.28, the build that passed all tests), because creating a Circle API key failed on Circle's side. The deployed code matches the compiled code except for the USDC address slots.

## Tech stack

- Solidity 0.8.28 with Foundry and OpenZeppelin
- React, Vite, TypeScript, wagmi, viem, ConnectKit
- GSAP and Lenis for the scroll animation; a split-flap departures board built in React
- Arc, USDC
- A Cloudflare Pages Function (`functions/rpc.ts`) relays read-only RPC calls from the browser when hosted

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://book.getfoundry.sh).

```bash
bun install
bun run dev
bun run build
```

### Run the contract tests

```bash
bun run contracts:build
bun run contracts:test
```

The suite in `contracts/test/Span.t.sol` covers every path above, the time-window edges, blocked-wallet withdrawals, and fuzz and invariant checks that the contract's USDC balance always equals what it owes.

### Environment variables

- `VITE_SPAN_NETWORK`: set to `testnet` to point the app at the Arc Testnet deployment. Leave it unset for Arc mainnet.
- `VITE_GITHUB_URL`: optional. When set, the landing footer shows a GitHub link to it.
