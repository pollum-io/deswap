import { ftch, jsonrpc } from 'micro-ftch';
import { QuoteRequest, QuoteResponse, SwapRequest, SwapResponse, TokenInfo, ApprovalResponse } from '@/types';
import { addr } from 'micro-eth-signer';
import { createContract } from 'micro-eth-signer/abi';
import { amounts } from 'micro-eth-signer/utils';
import { Web3Provider } from 'micro-eth-signer/net';
import { SUPPORTED_CHAINS, RPCS, ERC20_ABI, ONEINCH_SPENDER_ADDRESSES } from '@/config/constants';

export class OneInchProvider {
    private readonly fetch: ReturnType<typeof ftch>;
    private readonly apiKey: string;
    private readonly referrerAddress: string;
    private readonly fee = '1'; // 1% fee

    constructor() {
        const apiKey = process.env.ONEINCH_API_KEY;
        const referrerAddress = process.env.EVM_REFERRER_ADDRESS;

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

    private getProvider(chainId: string): Web3Provider {
        const rpcUrl = RPCS[chainId as keyof typeof RPCS][0]
        const provider = new Web3Provider(
            jsonrpc(fetch, rpcUrl)
        );

        if (!provider) {
            throw new Error(`No provider available for chain ${chainId}`);
        }
        return provider;
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
    ): Promise<ApprovalResponse | null> {
        const spender = ONEINCH_SPENDER_ADDRESSES[chainId as keyof typeof RPCS];
        if (!spender) throw new Error(`No spender address for chain ${chainId}`);

        const provider = this.getProvider(chainId);
        const contract = createContract(ERC20_ABI, provider, tokenAddress);

        // Check current allowance
        const currentAllowance = await contract.allowance.call({
            owner: userAddress,
            spender
        });

        if (BigInt(currentAllowance) >= BigInt(amount)) {
            return null;
        }

        // Generate approval data
        const data = contract.approve.encodeInput({
            spender,
            amount: amounts.maxUint256
        });

        // Estimate gas
        const gasLimit = await provider.estimateGas({
            from: userAddress,
            to: tokenAddress,
            data: Buffer.from(data).toString('hex')
        });

        // Get gas price
        const gasPrice = await provider.call('eth_gasPrice', []);

        return {
            provider: 'approval',
            chainId,
            token: tokenAddress,
            spender,
            owner: userAddress,
            amount: amounts.maxUint256.toString(),
            data: `0x${Buffer.from(data).toString('hex')}`,
            gasLimit: this.adjustGasLimit(gasLimit.toString()),
            gasPrice: gasPrice.toString()
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

    async getSwap(request: SwapRequest): Promise<SwapResponse | ApprovalResponse> {
        if (!this.validateRequest(request) || !addr.isValid(request.userAddress)) {
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

        if (request.fromToken !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
            const allowance = await this.checkAllowance(
                request.chainId,
                request.fromToken,
                request.userAddress,
                request.amount
            );
            if (allowance) {
                return allowance;
            }
        }

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
            slippage: request.slippage,
        };
    }
}