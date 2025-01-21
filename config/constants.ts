export const SUPPORTED_CHAINS = {
    '1': 'ethereum',
    '56': 'bsc',
    '137': 'polygon',
    '10': 'optimism',
    '42161': 'arbitrum',
    '43114': 'avalanche',
    '100': 'gnosis',
    '8453': 'base',
    '324': 'zksync',
    '101': 'solana'
};

export const RPCS = {
    '1': [  // Ethereum
        'https://eth.llamarpc.com/',
        'https://rpc.ankr.com/eth',
        'https://ethereum.publicnode.com/',
    ],
    '56': [ // BSC
        'https://bsc.llamarpc.com/',
        'https://bsc-dataseed1.binance.org/',
        'https://bsc-rpc.gateway.pokt.network/'
    ],
    '137': [ // Polygon
        'https://polygon.llamarpc.com/',
        'https://polygon-rpc.com/',
        'https://rpc.ankr.com/polygon'
    ],
    '10': [ // Optimism
        'https://optimism.llamarpc.com/',
        'https://mainnet.optimism.io/',
        'https://rpc.ankr.com/optimism'
    ],
    '42161': [ // Arbitrum
        'https://arbitrum.llamarpc.com/',
        'https://arb1.arbitrum.io/rpc',
        'https://rpc.ankr.com/arbitrum'
    ],
    '43114': [ // Avalanche
        'https://avalanche.public-rpc.com/',
        'https://api.avax.network/ext/bc/C/rpc',
        'https://rpc.ankr.com/avalanche'
    ],
    '100': [ // Gnosis
        'https://gnosis.publicnode.com/',
        'https://gnosis-mainnet.public.blastapi.io/',
        'https://rpc.ankr.com/gnosis'
    ],
    '8453': [ // Base
        'https://base.llamarpc.com/',
        'https://mainnet.base.org/',
        'https://base.gateway.tenderly.co/'
    ],
    '324': [ // ZkSync
        'https://mainnet.era.zksync.io/',
        'https://zksync-era.blockpi.network/v1/rpc/public',
        'https://zksync.meowrpc.com/'
    ],
};

export const ERC20_ABI = [
    {
        type: 'function',
        name: 'allowance',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
        ],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'approve',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable'
    }
] as const;

export const ONEINCH_SPENDER_ADDRESSES = {
    '1': '0x1111111254EEB25477B68fb85Ed929f73A960582',     // Ethereum
    '56': '0x1111111254EEB25477B68fb85Ed929f73A960582',    // BSC
    '137': '0x1111111254EEB25477B68fb85Ed929f73A960582',   // Polygon
    '10': '0x1111111254EEB25477B68fb85Ed929f73A960582',    // Optimism
    '42161': '0x1111111254EEB25477B68fb85Ed929f73A960582', // Arbitrum
    '43114': '0x1111111254EEB25477B68fb85Ed929f73A960582', // Avalanche
    '100': '0x1111111254EEB25477B68fb85Ed929f73A960582',   // Gnosis
    '8453': '0x1111111254EEB25477B68fb85Ed929f73A960582',  // Base
    '324': '0x6e2B76966cbD9cF4cC2Fa0D76d24d5241E0ABC2F',   // ZkSync
};