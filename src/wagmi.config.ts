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

export const citreaMainnet = defineChain({
  id: 1551,
  name: 'Citrea Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'cBTC',
    symbol: 'cBTC',
  },
  rpcUrls: {
    default: { 
      http: ['https://rpc.mainnet.citrea.xyz'] 
    },
  },
  blockExplorers: {
    default: { 
      name: 'Explorer', 
      url: 'https://explorer.mainnet.citrea.xyz' 
    },
  },
});

export const config = getDefaultConfig({
  appName: 'EVM Utils',
  projectId: 'YOUR_PROJECT_ID', // User will need to replace this with their WalletConnect project ID
  chains: [citreaTestnet, citreaMainnet],
  transports: {
    [citreaTestnet.id]: http('https://rpc.testnet.citrea.xyz'),
    [citreaMainnet.id]: http('https://rpc.mainnet.citrea.xyz'),
  },
  ssr: false,
});

