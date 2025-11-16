import { useState, useEffect } from 'preact/hooks'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { getContract, type Abi, type Address } from 'viem'
import { citreaTestnet } from './wagmi.config'

type Network = {
  id: number
  name: string
  rpcUrl: string
  explorerUrl: string
}

const defaultNetworks: Network[] = [
  {
    id: citreaTestnet.id,
    name: citreaTestnet.name,
    rpcUrl: citreaTestnet.rpcUrls.default.http[0],
    explorerUrl: citreaTestnet.blockExplorers!.default.url,
  },
]

export function App() {
  const [networks, setNetworks] = useState<Network[]>(defaultNetworks)
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
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedFunctions, setSelectedFunctions] = useState<Set<string>>(new Set())
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false)
  const [showAddNetworkModal, setShowAddNetworkModal] = useState(false)
  const [newNetwork, setNewNetwork] = useState<Network>({
    id: 0,
    name: '',
    rpcUrl: '',
    explorerUrl: '',
  })

  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const connectedChainId = useChainId()

  // Load from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const networkParam = params.get('network')
    const addressParam = params.get('address')
    const abiParam = params.get('abi')
    const networkDataParam = params.get('networkData')

    // Load custom network if provided
    if (networkDataParam) {
      try {
        const networkData = JSON.parse(atob(networkDataParam))
        const existingNetwork = networks.find(n => n.id === networkData.id)
        if (!existingNetwork) {
          setNetworks([...networks, networkData])
          setSelectedNetwork(networkData)
        }
      } catch (e) {
        console.error('Failed to parse network data from URL', e)
      }
    } else if (networkParam) {
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

  // Auto-collapse when all configuration is complete
  useEffect(() => {
    if (contractAddress && parsedAbi && !abiError) {
      setIsConfigCollapsed(true)
    }
  }, [contractAddress, parsedAbi, abiError])

  const handleShare = () => {
    if (!parsedAbi) {
      alert('Please provide a valid ABI')
      return
    }
    // Initialize with all functions selected
    const allFunctions = [...readFunctions, ...writeFunctions]
    setSelectedFunctions(new Set(allFunctions.map(f => f.name)))
    setShowShareModal(true)
  }

  const handleShareConfirm = () => {
    if (selectedFunctions.size === 0) {
      alert('Please select at least one function to share')
      return
    }

    // Filter ABI to only include selected functions
    const filteredAbi = parsedAbi!.filter(
      (item: any) => item.type === 'function' && selectedFunctions.has(item.name)
    )

    const compressed = compressAbi(filteredAbi)
    const params = new URLSearchParams({
      network: selectedNetwork.id.toString(),
      address: contractAddress,
      abi: compressed,
    })

    // Check if it's a custom network (not in default networks)
    const isCustomNetwork = !defaultNetworks.find(n => n.id === selectedNetwork.id)
    if (isCustomNetwork) {
      params.set('networkData', btoa(JSON.stringify(selectedNetwork)))
    }

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    navigator.clipboard.writeText(url)
    alert('Share URL copied to clipboard!')
    setShowShareModal(false)
  }

  const handleAddNetwork = () => {
    if (!newNetwork.name || !newNetwork.id || !newNetwork.rpcUrl) {
      alert('Please fill in all required fields')
      return
    }

    const existingNetwork = networks.find(n => n.id === newNetwork.id)
    if (existingNetwork) {
      alert('A network with this Chain ID already exists')
      return
    }

    setNetworks([...networks, newNetwork])
    setSelectedNetwork(newNetwork)
    setShowAddNetworkModal(false)
    setNewNetwork({ id: 0, name: '', rpcUrl: '', explorerUrl: '' })
  }

  const handleSwitchNetwork = async () => {
    if (!walletClient) {
      alert('Please connect your wallet first')
      return
    }

    try {
      const chainIdHex = `0x${selectedNetwork.id.toString(16)}`
      
      // First, try to switch to the network
      try {
        await walletClient.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        } as any)
      } catch (switchError: any) {
        // If the network doesn't exist (error 4902), add it
        if (switchError.code === 4902) {
          await walletClient.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainIdHex,
                chainName: selectedNetwork.name,
                rpcUrls: [selectedNetwork.rpcUrl],
                blockExplorerUrls: selectedNetwork.explorerUrl
                  ? [selectedNetwork.explorerUrl]
                  : undefined,
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
              },
            ],
          } as any)
        } else {
          throw switchError
        }
      }
    } catch (error: any) {
      console.error('Failed to switch network:', error)
      alert(`Failed to switch network: ${error.message || 'Unknown error'}`)
    }
  }

  const toggleFunction = (funcName: string) => {
    const newSelected = new Set(selectedFunctions)
    if (newSelected.has(funcName)) {
      newSelected.delete(funcName)
    } else {
      newSelected.add(funcName)
    }
    setSelectedFunctions(newSelected)
  }

  const toggleSelectAll = () => {
    const allFunctions = [...readFunctions, ...writeFunctions]
    if (selectedFunctions.size === allFunctions.length) {
      setSelectedFunctions(new Set())
    } else {
      setSelectedFunctions(new Set(allFunctions.map(f => f.name)))
    }
  }

  const compressAbi = (abi: any[]): string => {
    // Extract only function signatures and essential info
    const compressed = abi.map((item: any) => ({
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
      <div key={key} class="border border-gray-300 rounded p-2 mb-2">
        <div class="flex items-center justify-between mb-1">
          <h3 class="font-semibold text-sm">{func.name}</h3>
          {func.stateMutability === 'payable' && (
            <span class="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">
              Payable
            </span>
          )}
        </div>

        {func.inputs && func.inputs.length > 0 && (
          <div class="mb-2 space-y-1">
            {func.inputs.map((input: any, idx: number) => (
              <div key={idx}>
                <label class="block text-xs font-medium text-gray-700 mb-0.5">
                  {input.name || `param${idx}`} ({input.type})
                </label>
                <input
                  type="text"
                  class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          class="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading[key] ? 'Loading...' : isWrite ? 'Write' : 'Query'}
        </button>

        {functionResults[key] && (
          <div class="mt-2 p-2 bg-gray-100 rounded">
            <p class="text-xs font-mono break-all">{functionResults[key]}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div class="min-h-screen bg-gray-50">
      <div class="w-full px-8 py-8">
        {/* Header */}
        <div class="flex justify-between items-center mb-4">
          <h1 class="text-2xl font-bold text-gray-900">EVM Utils</h1>
          <ConnectButton />
        </div>

        {/* Wrong Network Warning */}
        {address && connectedChainId !== selectedNetwork.id && (
          <div class="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded-lg mb-3 text-sm flex items-center justify-between">
            <span>
              <strong>⚠️ Wrong Network:</strong> Please switch to{' '}
              <strong>{selectedNetwork.name}</strong> (Chain ID: {selectedNetwork.id})
            </span>
            <button
              onClick={handleSwitchNetwork}
              class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm ml-3 whitespace-nowrap"
            >
              Switch Network
            </button>
          </div>
        )}

        {/* Configuration Section - Collapsible */}
        <div class="bg-white rounded-lg shadow-md mb-3">
          {isConfigCollapsed ? (
            // Collapsed View
            <div
              class="p-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setIsConfigCollapsed(false)}
            >
              <div class="flex justify-between items-center">
                <div class="flex-1">
                  <p class="text-xs text-gray-600">
                    <span class="font-medium">{selectedNetwork.name}</span>
                    {' • '}
                    <span class="font-mono">{contractAddress}</span>
                  </p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    RPC: {selectedNetwork.rpcUrl}
                  </p>
                </div>
                <button class="text-gray-500 hover:text-gray-700 text-sm ml-2">
                  ▼ Expand
                </button>
              </div>
            </div>
          ) : (
            // Expanded View
            <div class="p-3">
              <div class="flex justify-between items-center mb-3">
                <h3 class="text-sm font-semibold text-gray-900">Configuration</h3>
                <button
                  onClick={() => setIsConfigCollapsed(true)}
                  class="text-gray-500 hover:text-gray-700 text-sm"
                >
                  ▲ Collapse
                </button>
              </div>

              {/* Network Selector */}
              <div class="mb-3">
                <div class="flex justify-between items-center mb-1">
                  <label class="block text-xs font-medium text-gray-700">Network</label>
                  <button
                    onClick={() => setShowAddNetworkModal(true)}
                    class="text-xs text-blue-600 hover:text-blue-700"
                  >
                    + Add Network
                  </button>
                </div>
                <select
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <div class="mb-3">
                <label class="block text-xs font-medium text-gray-700 mb-1">
                  Contract Address
                </label>
                <input
                  type="text"
                  class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="0x3100000000000000000000000000000000000002"
                  value={contractAddress}
                  onInput={(e) => setContractAddress((e.target as HTMLInputElement).value)}
                />
              </div>

              {/* Contract ABI */}
              <div>
                <div class="flex justify-between items-center mb-1">
                  <label class="block text-xs font-medium text-gray-700">Contract ABI</label>
                  <button
                    onClick={handleShare}
                    class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                  >
                    Share
                  </button>
                </div>
                <textarea
                  class="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                  rows={8}
                  placeholder="Paste contract ABI JSON here..."
                  value={contractAbi}
                  onInput={(e) => setContractAbi((e.target as HTMLTextAreaElement).value)}
                />
                {abiError && <p class="text-red-600 text-xs mt-1">{abiError}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Contract Interaction Side by Side */}
        {parsedAbi && !abiError && (
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Read Contract */}
            <div class="bg-white rounded-lg shadow-md p-3">
              <h2 class="text-base font-bold mb-2 text-gray-900">
                Read Contract ({readFunctions.length})
              </h2>
              <div>
                {readFunctions.length === 0 ? (
                  <p class="text-gray-500 text-sm">No read functions found in ABI</p>
                ) : (
                  readFunctions.map((func) => renderFunction(func, false))
                )}
              </div>
            </div>

            {/* Write Contract */}
            <div class="bg-white rounded-lg shadow-md p-3">
              <h2 class="text-base font-bold mb-2 text-gray-900">
                Write Contract ({writeFunctions.length})
              </h2>
              <div>
                {writeFunctions.length === 0 ? (
                  <p class="text-gray-500 text-sm">No write functions found in ABI</p>
                ) : (
                  writeFunctions.map((func) => renderFunction(func, true))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div class="p-4 border-b border-gray-200">
                <div class="flex justify-between items-center">
                  <h2 class="text-lg font-bold text-gray-900">Select Functions to Share</h2>
                  <button
                    onClick={() => setShowShareModal(false)}
                    class="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div class="p-4 overflow-y-auto flex-1">
                <div class="mb-3">
                  <button
                    onClick={toggleSelectAll}
                    class="bg-gray-200 text-gray-800 px-3 py-1 text-sm rounded hover:bg-gray-300"
                  >
                    {selectedFunctions.size === readFunctions.length + writeFunctions.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                  <span class="ml-3 text-sm text-gray-600">
                    {selectedFunctions.size} of {readFunctions.length + writeFunctions.length} selected
                  </span>
                </div>

                {readFunctions.length > 0 && (
                  <div class="mb-4">
                    <h3 class="font-semibold text-sm mb-2 text-gray-700">Read Functions</h3>
                    <div class="space-y-1">
                      {readFunctions.map((func) => (
                        <label
                          key={func.name}
                          class="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFunctions.has(func.name)}
                            onChange={() => toggleFunction(func.name)}
                            class="mr-2 w-4 h-4"
                          />
                          <span class="text-sm">{func.name}</span>
                          {func.inputs && func.inputs.length > 0 && (
                            <span class="ml-2 text-xs text-gray-500">
                              ({func.inputs.map((i: any) => i.type).join(', ')})
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {writeFunctions.length > 0 && (
                  <div>
                    <h3 class="font-semibold text-sm mb-2 text-gray-700">Write Functions</h3>
                    <div class="space-y-1">
                      {writeFunctions.map((func) => (
                        <label
                          key={func.name}
                          class="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFunctions.has(func.name)}
                            onChange={() => toggleFunction(func.name)}
                            class="mr-2 w-4 h-4"
                          />
                          <span class="text-sm">{func.name}</span>
                          {func.inputs && func.inputs.length > 0 && (
                            <span class="ml-2 text-xs text-gray-500">
                              ({func.inputs.map((i: any) => i.type).join(', ')})
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div class="p-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  onClick={() => setShowShareModal(false)}
                  class="bg-gray-200 text-gray-800 px-4 py-2 text-sm rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShareConfirm}
                  class="bg-green-600 text-white px-4 py-2 text-sm rounded hover:bg-green-700"
                >
                  Share Selected
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Network Modal */}
        {showAddNetworkModal && (
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div class="p-4 border-b border-gray-200">
                <div class="flex justify-between items-center">
                  <h2 class="text-lg font-bold text-gray-900">Add Custom Network</h2>
                  <button
                    onClick={() => setShowAddNetworkModal(false)}
                    class="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div class="p-4 space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Network Name *
                  </label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., Ethereum Mainnet"
                    value={newNetwork.name}
                    onInput={(e) =>
                      setNewNetwork({ ...newNetwork, name: (e.target as HTMLInputElement).value })
                    }
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Chain ID *
                  </label>
                  <input
                    type="number"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., 1"
                    value={newNetwork.id || ''}
                    onInput={(e) =>
                      setNewNetwork({
                        ...newNetwork,
                        id: parseInt((e.target as HTMLInputElement).value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    RPC URL *
                  </label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="https://..."
                    value={newNetwork.rpcUrl}
                    onInput={(e) =>
                      setNewNetwork({ ...newNetwork, rpcUrl: (e.target as HTMLInputElement).value })
                    }
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Explorer URL (optional)
                  </label>
                  <input
                    type="text"
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="https://..."
                    value={newNetwork.explorerUrl}
                    onInput={(e) =>
                      setNewNetwork({
                        ...newNetwork,
                        explorerUrl: (e.target as HTMLInputElement).value,
                      })
                    }
                  />
                </div>
              </div>

              <div class="p-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAddNetworkModal(false)
                    setNewNetwork({ id: 0, name: '', rpcUrl: '', explorerUrl: '' })
                  }}
                  class="bg-gray-200 text-gray-800 px-4 py-2 text-sm rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNetwork}
                  class="bg-blue-600 text-white px-4 py-2 text-sm rounded hover:bg-blue-700"
                >
                  Add Network
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
