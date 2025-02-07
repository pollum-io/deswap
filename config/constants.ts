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
        'https://delicate-snowy-friday.quiknode.pro/241eddf89687a5593096dbd4fff60b0dc84bdbb3',
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
    },
    {
        type: 'function',
        name: 'symbol',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'name',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view'
    },
    {
        type: 'function',
        name: 'decimals',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view'
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

export const UNISWAP_V2_FACTORY_ADDRESSES = {
    '1': '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    '8453': '0x8909dc15e40173ff4699343b6eb8132c65e18ec6'
};

export const UNISWAP_V3_FACTORY_ADDRESSES = {
    '1': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    '8453': '0x33128a8fC17869897dcE68Ed026d694621f6FDfD'
};

export const UNISWAP_MIXED_ROUTE_QUOTER_ADDRESSES = {
    '1': '0x84E44095eeBfEC7793Cd7d5b57B7e401D7f1cA2E',
    '8453': '0x7A95d40c46B9456521276a5f4bC466f2c9b617E2'
};

export const UNISWAP_UNIVERSAL_ROUTER = {
    '1': '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    '8453': '0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC'
};

export const UNISWAP_SUBGRAPH_URL = {
    '1': {
        v2: 'https://gateway.thegraph.com/api/38b008cde360aa46559b6c06b6d50802/subgraphs/id/EYCKATKGBKLWvSfwvBjzfCBmGwYNdVkduYXVivCsLRFu',
        v3: 'https://gateway.thegraph.com/api/38b008cde360aa46559b6c06b6d50802/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV'
    },
    '8453': {
        v2: 'https://api.studio.thegraph.com/query/48211/uniswap-v2-base/version/latest',
        v3: 'https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest'
    }
};

export const MIXED_ROUTE_QUOTER_V1_ABI = [
    {
        inputs: [
            { name: 'path', type: 'bytes' },
            { name: 'amountIn', type: 'uint256' }
        ],
        name: 'quoteExactInput',
        outputs: [
            { name: 'amountOut', type: 'uint256' },
            { name: 'sqrtPriceX96AfterList', type: 'uint160[]' },
            { name: 'initializedTicksCrossedList', type: 'uint32[]' },
            { name: 'gasEstimate', type: 'uint256' }
        ],
        stateMutability: 'nonpayable',
        type: 'function'
    }
] as const;

// Add at the top of your class or as a constant file
export const BASE_TOKENS = {
    '1': [ // Ethereum
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7'  // USDT
    ],
    '8453': [ // Base
        '0x4200000000000000000000000000000000000006', // WETH
        '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDbC
        '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'  // DAI
    ]
};

// minimum reserves USD thresholds by chain
export const MIN_RESERVE_USD = {
    '1': 10000,    // $10k on Ethereum
    '8453': 50000  // $5k on Base
};

