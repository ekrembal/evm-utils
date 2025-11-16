import { useState, useEffect } from 'preact/hooks'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { getContract, type Abi, type Address } from 'viem'
import { citreaTestnet, citreaMainnet } from './wagmi.config'

type Network = {
  id: number
  name: string
  rpcUrl: string
  explorerUrl: string
}

const networks: Network[] = [
  {
    id: citreaTestnet.id,
    name: citreaTestnet.name,
    rpcUrl: citreaTestnet.rpcUrls.default.http[0],
    explorerUrl: citreaTestnet.blockExplorers!.default.url,
  },
  {
    id: citreaMainnet.id,
    name: citreaMainnet.name,
    rpcUrl: citreaMainnet.rpcUrls.default.http[0],
    explorerUrl: citreaMainnet.blockExplorers!.default.url,
  },
]

export function App() {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(networks[0])
  const [contractAddress, setContractAddress] = useState('')
  const [contractAbi, setContractAbi] = useState('')
  const [parsedAbi, setParsedAbi] = useState<Abi | null>(null)
  const [abiError, setAbiError] = useState('')
  const [readFunctions, setReadFunctions] = useState<any[]>([])
  const [writeFunctions, setWriteFunctions] = useState<any[]>([])
  const [functionInputs, setFunctionInputs] = useState<Record<string, any[]>>({})
  const [functionResults, setFunctionResults] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  // Load from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const networkParam = params.get('network')
    const addressParam = params.get('address')
    const abiParam = params.get('abi')

    if (networkParam) {
      const network = networks.find(n => n.id === parseInt(networkParam))
      if (network) setSelectedNetwork(network)
    }

    if (addressParam) {
      setContractAddress(addressParam)
    }

    if (abiParam) {
      try {
        const decompressed = decompressAbi(abiParam)
        setContractAbi(JSON.stringify(decompressed, null, 2))
      } catch (e) {
        console.error('Failed to decompress ABI from URL', e)
      }
    }
  }, [])

  // Parse ABI whenever it changes
  useEffect(() => {
    if (!contractAbi.trim()) {
      setParsedAbi(null)
      setReadFunctions([])
      setWriteFunctions([])
      setAbiError('')
      return
    }

    try {
      const parsed = JSON.parse(contractAbi)
      setParsedAbi(parsed)
      setAbiError('')

      // Separate read and write functions
      const reads = parsed.filter(
        (item: any) =>
          item.type === 'function' &&
          (item.stateMutability === 'view' || item.stateMutability === 'pure')
      )
      const writes = parsed.filter(
        (item: any) =>
          item.type === 'function' &&
          (item.stateMutability === 'nonpayable' || item.stateMutability === 'payable')
      )

      setReadFunctions(reads)
      setWriteFunctions(writes)
    } catch (e: any) {
      setAbiError('Invalid JSON: ' + e.message)
      setParsedAbi(null)
      setReadFunctions([])
      setWriteFunctions([])
    }
  }, [contractAbi])

  const handleShare = () => {
    if (!parsedAbi) {
      alert('Please provide a valid ABI')
      return
    }

    const compressed = compressAbi(parsedAbi)
    const params = new URLSearchParams({
      network: selectedNetwork.id.toString(),
      address: contractAddress,
      abi: compressed,
    })

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    navigator.clipboard.writeText(url)
    alert('Share URL copied to clipboard!')
  }

  const compressAbi = (abi: Abi): string => {
    // Extract only function signatures and essential info
    const compressed = abi
      .filter((item: any) => item.type === 'function')
      .map((item: any) => ({
        type: 'function',
        name: item.name,
        inputs: item.inputs,
        outputs: item.outputs,
        stateMutability: item.stateMutability,
      }))
    return btoa(JSON.stringify(compressed))
  }

  const decompressAbi = (compressed: string): Abi => {
    return JSON.parse(atob(compressed))
  }

  const handleReadFunction = async (func: any) => {
    if (!publicClient || !contractAddress) return

    const key = func.name
    setLoading({ ...loading, [key]: true })

    try {
      const contract = getContract({
        address: contractAddress as Address,
        abi: parsedAbi!,
        client: publicClient,
      })

      const inputs = functionInputs[key] || []
      const result = await (contract as any).read[func.name](inputs)

      setFunctionResults({ ...functionResults, [key]: result?.toString() || 'Success' })
    } catch (e: any) {
      setFunctionResults({ ...functionResults, [key]: 'Error: ' + e.message })
    } finally {
      setLoading({ ...loading, [key]: false })
    }
  }

  const handleWriteFunction = async (func: any) => {
    if (!walletClient || !contractAddress || !address) {
      alert('Please connect your wallet')
      return
    }

    const key = func.name
    setLoading({ ...loading, [key]: true })

    try {
      const contract = getContract({
        address: contractAddress as Address,
        abi: parsedAbi!,
        client: { public: publicClient!, wallet: walletClient },
      })

      const inputs = functionInputs[key] || []
      const hash = await (contract as any).write[func.name](inputs)

      setFunctionResults({
        ...functionResults,
        [key]: `Transaction sent: ${hash}`,
      })
    } catch (e: any) {
      setFunctionResults({ ...functionResults, [key]: 'Error: ' + e.message })
    } finally {
      setLoading({ ...loading, [key]: false })
    }
  }

  const updateFunctionInput = (funcName: string, index: number, value: string) => {
    const current = functionInputs[funcName] || []
    const updated = [...current]
    updated[index] = value
    setFunctionInputs({ ...functionInputs, [funcName]: updated })
  }

  const renderFunction = (func: any, isWrite: boolean) => {
    const key = func.name

    return (
      <div key={key} class="border border-gray-300 rounded-lg p-4 mb-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold text-lg">{func.name}</h3>
          {func.stateMutability === 'payable' && (
            <span class="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
              Payable
            </span>
          )}
        </div>

        {func.inputs && func.inputs.length > 0 && (
          <div class="mb-3 space-y-2">
            {func.inputs.map((input: any, idx: number) => (
              <div key={idx}>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  {input.name || `param${idx}`} ({input.type})
                </label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={input.type}
                  value={functionInputs[key]?.[idx] || ''}
                  onInput={(e) =>
                    updateFunctionInput(key, idx, (e.target as HTMLInputElement).value)
                  }
                />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => (isWrite ? handleWriteFunction(func) : handleReadFunction(func))}
          disabled={loading[key]}
          class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading[key] ? 'Loading...' : isWrite ? 'Write' : 'Query'}
        </button>

        {functionResults[key] && (
          <div class="mt-3 p-3 bg-gray-100 rounded-md">
            <p class="text-sm font-mono break-all">{functionResults[key]}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div class="min-h-screen bg-gray-50">
      <div class="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div class="flex justify-between items-center mb-8">
          <h1 class="text-3xl font-bold text-gray-900">EVM Utils</h1>
          <ConnectButton />
        </div>

        {/* Network Selector */}
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Network</label>
          <select
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedNetwork.id}
            onChange={(e) => {
              const network = networks.find(
                (n) => n.id === parseInt((e.target as HTMLSelectElement).value)
              )
              if (network) setSelectedNetwork(network)
            }}
          >
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name}
              </option>
            ))}
          </select>
        </div>

        {/* Contract Address */}
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Contract Address
          </label>
          <input
            type="text"
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            placeholder="0x3100000000000000000000000000000000000002"
            value={contractAddress}
            onInput={(e) => setContractAddress((e.target as HTMLInputElement).value)}
          />
        </div>

        {/* Contract ABI */}
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <div class="flex justify-between items-center mb-2">
            <label class="block text-sm font-medium text-gray-700">Contract ABI</label>
            <button
              onClick={handleShare}
              class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
            >
              Share
            </button>
          </div>
          <textarea
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows={10}
            placeholder="Paste contract ABI JSON here..."
            value={contractAbi}
            onInput={(e) => setContractAbi((e.target as HTMLTextAreaElement).value)}
          />
          {abiError && <p class="text-red-600 text-sm mt-2">{abiError}</p>}
        </div>

        {/* Contract Interaction Side by Side */}
        {parsedAbi && !abiError && (
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Read Contract */}
            <div class="bg-white rounded-lg shadow-md p-6">
              <h2 class="text-xl font-bold mb-4 text-gray-900">
                Read Contract ({readFunctions.length})
              </h2>
              <div>
                {readFunctions.length === 0 ? (
                  <p class="text-gray-500">No read functions found in ABI</p>
                ) : (
                  readFunctions.map((func) => renderFunction(func, false))
                )}
              </div>
            </div>

            {/* Write Contract */}
            <div class="bg-white rounded-lg shadow-md p-6">
              <h2 class="text-xl font-bold mb-4 text-gray-900">
                Write Contract ({writeFunctions.length})
              </h2>
              <div>
                {writeFunctions.length === 0 ? (
                  <p class="text-gray-500">No write functions found in ABI</p>
                ) : (
                  writeFunctions.map((func) => renderFunction(func, true))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
