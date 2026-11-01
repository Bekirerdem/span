/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { arcMainnet, spanChain, spanTransport, NETWORK } from './span/chain'
import { arcTestnet } from 'viem/chains'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(spanChain.id, spanChain.rpcUrls.default.http[0])

export const config = createConfig({
  chains: [spanChain, mainnet], // mainnet needed for ENS resolution
  connectors: [injected()],
  transports: {
    [arcMainnet.id]: NETWORK === 'mainnet' ? spanTransport : http(),
    [arcTestnet.id]: NETWORK === 'testnet' ? spanTransport : http(),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
