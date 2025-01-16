import { ftch } from 'micro-ftch';
import { QuoteRequest, QuoteResponse, SwapRequest, TokenInfo } from '../../types';
import { validateAddress } from 'micro-sol-signer';
import { SUPPORTED_CHAINS } from '@/config/constants';

export class JupiterProvider {
    private readonly fetch: ReturnType<typeof ftch>;

    constructor() {

        this.fetch = ftch(globalThis.fetch, {
            timeout: 10000,
            concurrencyLimit: 5,
            log: process.env.NODE_ENV === 'development'
                ? (url, opts) => console.log('Jupiter API call:', url, opts)
                : undefined,
        });
    }

    private getApiUrl(path: string): string {
        return `https://quote-api.jup.ag/v6${path}`;
    }

    private async makeRequest<T>(path: string, params: Record<string, string>): Promise<T> {
        const url = this.getApiUrl(path);
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = `${url}?${queryString}`;

        const response = await this.fetch(fullUrl, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Jupiter API error: ${error.error || error.message || 'Unknown error'}`);
        }

        return response.json();
    }

    private validateRequest(request: QuoteRequest | SwapRequest): boolean {

        if (!(request.chainId in SUPPORTED_CHAINS)) {
            return false;
        }
        validateAddress(request.fromToken)
        validateAddress(request.toToken)

        if (BigInt(request.amount) <= BigInt(0)) {
            return false;
        }

        return true;
    }

    async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
        if (!this.validateRequest(request)) {
            throw new Error('Invalid request parameters');
        }

        const params = {
            inputMint: request.fromToken,
            outputMint: request.toToken,
            amount: request.amount,
            platformFeeBps: '100' // 1% in bps
        };

        const quote = await this.makeRequest<{
            inputMint: string;
            inAmount: string;
            outputMint: string;
            outAmount: string;
            otherAmountThreshold: string;
            slippageBps: number;
            priceImpactPct: string;
            routePlan: Array<{
                swapInfo: {
                    ammKey: string;
                    label?: string;
                    inputMint: string;
                    outputMint: string;
                    inAmount: string;
                    outAmount: string;
                },
                percent: string;
            }>;
        }>('/quote', params);

        // Fetch token metadata
        const [srcTokenInfo, dstTokenInfo] = await Promise.all([
            this.fetchTokenInfo(quote.inputMint),
            this.fetchTokenInfo(quote.outputMint)
        ]);

        return {
            provider: 'jupiter',
            chainId: request.chainId,
            srcToken: srcTokenInfo,
            dstToken: dstTokenInfo,
            fromAmount: quote.inAmount,
            dstAmount: quote.outAmount,
            priceImpactPct: quote.priceImpactPct,
            slippageBps: quote.slippageBps.toString(),
            protocols: quote.routePlan.map(route => ({
                protocol: route.swapInfo.label || route.swapInfo.ammKey,
                percent: route.percent,
                inputAmount: route.swapInfo.inAmount,
                outputAmount: route.swapInfo.outAmount,
                from: route.swapInfo.inputMint,
                to: route.swapInfo.outputMint
            }))
        };
    }
    private async fetchTokenInfo(mintAddress: string): Promise<TokenInfo> {
        const response = await this.fetch(`https://tokens.jup.ag/token/${mintAddress}`, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Token info fetch failed');
        }

        const tokenData = await response.json();

        return {
            address: tokenData.address,
            symbol: tokenData.symbol,
            name: tokenData.name,
            decimals: tokenData.decimals,
        };
    }

}