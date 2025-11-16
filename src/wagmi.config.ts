import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';
import { http } from 'wagmi';

// Define Citrea chains
export const citreaTestnet = defineChain({
  id: 5115,
  name: 'Citrea Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'cBTC',
    symbol: 'cBTC',
  },
  rpcUrls: {
    default: { 
      http: ['https://rpc.testnet.citrea.xyz'] 
    },
  },
  blockExplorers: {
    default: { 
      name: 'Explorer', 
      url: 'https://explorer.testnet.citrea.xyz' 
    },
  },
});

export const citreaDevnet = defineChain({
  id: 62298,
  name: 'Citrea Devnet',
  nativeCurrency: {
    decimals: 18,
    name: 'cBTC',
    symbol: 'cBTC',
  },
  rpcUrls: {
    default: { 
      http: ['https://rpc.devnet.citrea.xyz'] 
    },
  },
  blockExplorers: {
    default: { 
      name: 'Explorer', 
      url: 'https://i-explorer.devnet.citrea.xyz' 
    },
  },
});

export const config = getDefaultConfig({
  appName: 'EVM Utils',
  projectId: 'YOUR_PROJECT_ID', // User will need to replace this with their WalletConnect project ID
  chains: [citreaTestnet, citreaDevnet],
  transports: {
    [citreaTestnet.id]: http('https://rpc.testnet.citrea.xyz'),
    [citreaDevnet.id]: http('https://rpc.devnet.citrea.xyz'),
  },
  ssr: false,
});

