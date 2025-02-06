// Base request interface
interface BaseRequest {
    chainId: string;
    fromToken: string;
    toToken: string;
    amount: string;
}

// Quote specific request
export interface QuoteRequest extends BaseRequest { }

// Swap specific request
export interface SwapRequest extends BaseRequest {
    userAddress: string;
    slippage: string;
}

// Token information
export interface TokenInfo {
    address: string;
    symbol?: string;
    name?: string;
    decimals?: number;
}

// Quote specific response
export interface QuoteResponse {
    provider: string;
    chainId: string;
    srcToken: TokenInfo;
    dstToken: TokenInfo;
    fromAmount: string;
    dstAmount: string;
    protocols: any[];
    gas?: string;
    slippageBps?: string;
    priceImpactPct?: string;
}


// Swap specific response
export interface SwapResponse {
    provider: string;
    chainId: string;
    srcToken: TokenInfo;
    dstToken: TokenInfo;
    dstAmount: string;
    fromAmount: string;
    from: string;
    data: string;
    protocols: any[];
    to?: string;
    value?: string;
    gasLimit?: string;
    gasPrice?: string;
    lastValidBlockHeight?: string;
    slippage: string;
    priceImpactPct?: string;
}

// Get swap transaction
export interface JupiterSwapResponse {
    swapTransaction: string;
    lastValidBlockHeight: number;
}

export interface ApprovalResponse {
    provider: string;
    chainId: string;
    to: string;
    from: string;
    amount: string;
    data: string;
    gasLimit: string;
    gasPrice: string;
}

export interface Pool {
    id: string;
    token0: {
        id: string
        decimals: number
    };
    token1: {
        id: string
        decimals: number
    };
    type: 'v2' | 'v3';
    // V2 specific
    reserve0?: string;
    reserve1?: string;
    reserveUSD?: string;
    // V3 specific
    feeTier?: string;
    liquidity?: string;
    sqrtPrice?: string;
    tick?: string;
    totalValueLockedUSD?: string;
}

export interface Route {
    pools: Pool[];
    path: string[];
}

export interface CandidatePools {
    topByBaseWithTokenIn: Pool[];      // Best pools connecting input token to base tokens
    topByBaseWithTokenOut: Pool[];     // Best pools connecting output token to base tokens
    topByDirectSwapPool: Pool[];       // Direct pools between input/output
    topByTVL: Pool[];                  // Overall highest TVL pools
    topByTVLUsingTokenIn: Pool[];      // Highest TVL pools with input token
    topByTVLUsingTokenOut: Pool[];     // Highest TVL pools with output token
    topByTVLUsingTokenInSecondHops: Pool[];  // Second hop pools from input
    topByTVLUsingTokenOutSecondHops: Pool[]; // Second hop pools to output
}

export interface PoolsByType {
    v2: Pool[];
    v3: Pool[];
}