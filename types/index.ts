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

// Allowance information
export interface AllowanceInfo {
    required: string;
    current: string;
    approved: boolean;
    approvalNeeded?: {
        to: string;
        data: string;
        value: string;
        gasPrice: string;
    }
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
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice: string;
    protocols: string[]
}