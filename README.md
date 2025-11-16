# EVM Utils

A single-page application for interacting with EVM smart contracts on Citrea networks.

## ⚠️ Vibecoded Warning

**This entire project was vibecoded by Claude (Anthropic's AI assistant, Sonnet 4.5, yes the one typing this very sentence right now 🤖). Every line of code, every commit message, and yes, even this warning was generated through the mystical art of vibes and tokens. Use at your own risk. The AI might have hallucinated some bugs. Or features. Hard to tell sometimes.**

*P.S. - If this actually works, you're welcome. If it doesn't, well... I'm just a large language model trying my best. - Claude 💙*

## Features

- 🔌 **Wallet Connection**: Connect your wallet using RainbowKit
- 🌐 **Network Selector**: Citrea Testnet support
- 📝 **Contract Interaction**: 
  - Input contract address
  - Paste contract ABI
  - Read from contracts (view/pure functions)
  - Write to contracts (state-changing functions)
- 🔗 **Share Functionality**: Generate shareable URLs with compressed ABI data
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Supported Networks

- **Citrea Testnet**
  - Chain ID: 5115
  - RPC: https://rpc.testnet.citrea.xyz/
  - Explorer: https://explorer.testnet.citrea.xyz

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update WalletConnect Project ID:
   - Edit `src/wagmi.config.ts`
   - Replace `YOUR_PROJECT_ID` with your WalletConnect Cloud project ID
   - Get one for free at: https://cloud.walletconnect.com/

3. Run the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

The build will create a single HTML file in the `dist` folder thanks to `vite-plugin-singlefile`.

## Tech Stack

- **Preact**: Lightweight React alternative
- **TypeScript**: Type safety
- **Viem**: Ethereum library
- **Wagmi**: React hooks for Ethereum
- **RainbowKit**: Wallet connection UI
- **TailwindCSS**: Utility-first CSS
- **Vite**: Build tool
- **vite-plugin-singlefile**: Single HTML output

## Usage

1. **Connect Wallet**: Click "Connect Wallet" in the top right
2. **Select Network**: Citrea Testnet
3. **Enter Contract Address**: Input the contract address you want to interact with
4. **Paste ABI**: Copy and paste the contract's ABI JSON
5. **Interact**: 
   - Use "Read Contract" section for view functions
   - Use "Write Contract" section for state-changing functions
6. **Share**: Click "Share" to selectively share functions via URL

## URL Parameters

The app supports loading contract data from URL parameters:
- `network`: Network ID (5115 for testnet)
- `address`: Contract address
- `abi`: Compressed ABI (base64 encoded)

Example:
```
https://your-domain.com/?network=5115&address=0x...&abi=eyJ0eXBl...
```

## License

MIT

