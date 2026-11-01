import { createPublicClient, defineChain, fallback, http } from 'viem'
import { arcTestnet } from 'viem/chains'

export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' } },
})

const DEPLOYMENTS = {
  mainnet: { chain: arcMainnet, span: '0x17126d2F33C988fcF11952423d4585Bf94b1Cf67' },
  testnet: { chain: arcTestnet, span: '0xacf81a650c5b2741e280e666ef9ee9666ad131e8' },
} as const

export type Network = keyof typeof DEPLOYMENTS

export const NETWORK: Network = import.meta.env.VITE_SPAN_NETWORK === 'testnet' ? 'testnet' : 'mainnet'
export const spanChain = DEPLOYMENTS[NETWORK].chain
export const SPAN_ADDRESS = DEPLOYMENTS[NETWORK].span as `0x${string}`
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const
export const EXPLORER = spanChain.blockExplorers.default.url

// Some networks get 503s (without CORS headers) from Arc's public RPC, so reads try a same-origin
// relay (functions/rpc.ts on Cloudflare Pages) first, then keyless public providers.
const hosted = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname) && !window.location.hostname.endsWith('arc.io')
const opts = { retryCount: 1, timeout: 12_000 }
export const spanTransport =
  NETWORK === 'mainnet'
    ? fallback([...(hosted ? [http('/rpc', opts)] : []), http('https://arc-rpc.publicnode.com', opts), http('https://rpc.mainnet.arc.io', opts)])
    : fallback([http('https://rpc.testnet.arc.io', opts), http('https://rpc.testnet.arc.network', opts)])

export const publicClient = createPublicClient({ chain: spanChain, transport: spanTransport })

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`
export const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`
