import { render } from 'preact'
import './index.css'
import '@rainbow-me/rainbowkit/styles.css'
import { App } from './app.tsx'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { config } from './wagmi.config'

const queryClient = new QueryClient()

render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider>
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>,
  document.getElementById('app')!
)
