import { ftch } from 'micro-ftch';
import { QuoteRequest, QuoteResponse, SwapRequest, SwapResponse, AllowanceInfo, TokenInfo } from '../../types';
import { addr } from 'micro-eth-signer';
import { SUPPORTED_CHAINS } from '../../config/constants';

export class OneInchProvider {
    private readonly fetch: ReturnType<typeof ftch>;
    private readonly apiKey: string;
    private readonly referrerAddress: string;
    private readonly fee = '1'; // 1% fee

    constructor() {
        const apiKey = process.env.ONEINCH_API_KEY;
        const referrerAddress = process.env.REFERRER_ADDRESS;

        if (!apiKey) throw new Error('ONEINCH_API_KEY is required');
        if (!referrerAddress) throw new Error('REFERRER_ADDRESS is required');
        if (!addr.isValid(referrerAddress)) throw new Error('Invalid REFERRER_ADDRESS');

        this.apiKey = apiKey;
        this.referrerAddress = referrerAddress;

        this.fetch = ftch(globalThis.fetch, {
            timeout: 10000,
            concurrencyLimit: 5,
            log: process.env.NODE_ENV === 'development'
                ? (url, opts) => console.log('1inch API call:', url, opts)
                : undefined,
        });
    }

    private getApiUrl(chainId: string, path: string): string {
        return `https://api.1inch.dev/swap/v6.0/${chainId}${path}`;
    }

    private async makeRequest<T>(chainId: string, path: string, params: Record<string, string>): Promise<T> {
        const url = this.getApiUrl(chainId, path);
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = `${url}?${queryString}`;

        const response = await this.fetch(fullUrl, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`1inch API error: ${error.description || error.message || 'Unknown error'}`);
        }

        return response.json();
    }

    private validateRequest(request: QuoteRequest | SwapRequest): boolean {
        if (!(request.chainId in SUPPORTED_CHAINS)) {
            return false;
        }

        try {
            if (!addr.isValid(request.fromToken) || !addr.isValid(request.toToken)) {
                return false;
            }
        } catch {
            return false;
        }

        if (BigInt(request.amount) <= BigInt(0)) {
            return false;
        }

        return true;
    }

    private adjustGasLimit(gas: string): string {
        return (BigInt(gas) * BigInt(125) / BigInt(100)).toString();
    }

    private async checkAllowance(
        chainId: string,
        tokenAddress: string,
        userAddress: string,
        amount: string
    ): Promise<AllowanceInfo> {
        const allowanceData = await this.makeRequest<{ allowance: string }>(chainId, '/approve/allowance', {
            tokenAddress: tokenAddress,
            walletAddress: userAddress
        });

        const currentAllowance = BigInt(allowanceData.allowance);
        const requiredAmount = BigInt(amount);
        const approved = currentAllowance >= requiredAmount;

        let approvalNeeded;
        if (!approved) {
            const approvalTx = await this.makeRequest<{
                to: string;
                data: string;
                value: string;
                gasPrice: string;
            }>(chainId, '/approve/transaction', {
                tokenAddress: tokenAddress
            });
            approvalNeeded = {
                to: approvalTx.to,
                data: approvalTx.data,
                value: approvalTx.value,
                gasPrice: approvalTx.gasPrice
            };
        }
        return {
            required: amount,
            current: allowanceData.allowance,
            approved,
            approvalNeeded
        };
    }

    async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
        if (!this.validateRequest(request)) {
            throw new Error('Invalid request parameters');
        }

        const params = {
            src: request.fromToken,
            dst: request.toToken,
            amount: request.amount,
            includeGas: 'true',
            includeTokensInfo: 'true',
            includeProtocols: 'true',
            fee: this.fee,
        };

        const quote = await this.makeRequest<{
            srcToken: TokenInfo;
            dstToken: TokenInfo;
            fromAmount: string;
            dstAmount: string;
            protocols: string[];
            gas: string;

        }>(request.chainId, '/quote', params);

        return {
            provider: '1inch',
            chainId: request.chainId,
            srcToken: {
                address: quote.srcToken.address,
                symbol: quote.srcToken.symbol,
                name: quote.srcToken.name,
                decimals: quote.srcToken.decimals,
            },
            dstToken: {
                address: quote.dstToken.address,
                symbol: quote.dstToken.symbol,
                name: quote.dstToken.name,
                decimals: quote.dstToken.decimals,
            },
            fromAmount: request.amount,
            dstAmount: quote.dstAmount,
            protocols: quote.protocols,
            gas: quote.gas,
        };
    }

    async getSwap(request: SwapRequest): Promise<SwapResponse> {
        if (!this.validateRequest(request)) {
            throw new Error('Invalid request parameters');
        }

        const params = {
            src: request.fromToken,
            dst: request.toToken,
            amount: request.amount,
            from: request.userAddress,
            origin: request.userAddress,
            slippage: request.slippage,
            includeTokensInfo: 'true',
            includeProtocols: 'true',
            fee: this.fee,
            referrerAddress: this.referrerAddress,
        };

        // let allowance;
        // if (request.fromToken !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        //     allowance = await this.checkAllowance(
        //         request.chainId,
        //         request.fromToken,
        //         request.userAddress,
        //         request.amount
        //     );
        // }

        const swap = await this.makeRequest<{
            srcToken: TokenInfo;
            dstToken: TokenInfo;
            fromAmount: string;
            dstAmount: string;
            protocols: string[];
            tx: {
                from: string;
                to: string;
                data: string;
                value: string;
                gas: string;
                gasPrice: string;
            }
        }>(request.chainId, '/swap', params);

        return {
            provider: '1inch',
            chainId: request.chainId,
            srcToken: {
                address: swap.srcToken.address,
                symbol: swap.srcToken.symbol,
                name: swap.srcToken.name,
                decimals: swap.srcToken.decimals,
            },
            dstToken: {
                address: swap.dstToken.address,
                symbol: swap.dstToken.symbol,
                name: swap.dstToken.name,
                decimals: swap.dstToken.decimals,
            },
            dstAmount: swap.dstAmount,
            fromAmount: request.amount,
            from: swap.tx.from,
            to: swap.tx.to,
            data: swap.tx.data,
            value: swap.tx.value,
            gasLimit: this.adjustGasLimit(swap.tx.gas),
            gasPrice: swap.tx.gasPrice,
            protocols: swap.protocols,
        };
    }
}