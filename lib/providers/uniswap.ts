import { ftch, jsonrpc } from 'micro-ftch';
import { QuoteRequest, QuoteResponse, TokenInfo, Route, Pool } from '@/types';
import { addr } from 'micro-eth-signer';
import { createContract } from 'micro-eth-signer/abi';
// import { amounts } from 'micro-eth-signer/utils';
import { Web3Provider } from 'micro-eth-signer/net';
import { ERC20_ABI, MIXED_ROUTE_QUOTER_V1_ABI, RPCS, UNISWAP_MIXED_ROUTE_QUOTER_ADDRESSES, UNISWAP_SUBGRAPH_URL } from '@/config/constants';

export class UniswapProvider {
    private readonly fetch: ReturnType<typeof ftch>;
    private readonly referrerAddress: string;

    constructor() {
        const referrerAddress = process.env.EVM_REFERRER_ADDRESS;
        if (!referrerAddress || !addr.isValid(referrerAddress)) {
            throw new Error('Invalid REFERRER_ADDRESS');
        }

        this.referrerAddress = referrerAddress;
        this.fetch = ftch(globalThis.fetch, {
            timeout: 10000,
            concurrencyLimit: 5,
            log: process.env.NODE_ENV === 'development'
                ? (url, opts) => console.log('Uniswap API call:', url, opts)
                : undefined,
        });
    }

    private getProvider(chainId: string): Web3Provider {
        const rpcUrl = RPCS[chainId as keyof typeof RPCS][0];
        return new Web3Provider(jsonrpc(fetch, rpcUrl));
    }

    private async getPoolsFromSubgraph(chainId: string, tokenA: string, tokenB: string): Promise<{ v2: Omit<Pool, 'type'>[]; v3: Omit<Pool, 'type'>[] }> {
        const v2Query = `{
            pairs(where: {
                token0_in: ["${tokenA.toLowerCase()}", "${tokenB.toLowerCase()}"],
                token1_in: ["${tokenA.toLowerCase()}", "${tokenB.toLowerCase()}"]
            }) {
                id
                token0 { id name symbol decimals }
                token1 { id name symbol decimals }
                reserve0
                reserve1
            }
        }`;

        const v3Query = `{
            pools(where: {
                token0_in: ["${tokenA.toLowerCase()}", "${tokenB.toLowerCase()}"],
                token1_in: ["${tokenA.toLowerCase()}", "${tokenB.toLowerCase()}"]
            }) {
                id
                token0 { id name symbol decimals }
                token1 { id name symbol decimals }
                feeTier
                sqrtPrice
                liquidity
                tick
            }
        }`;

        const [v2Pools, v3Pools] = await Promise.all([
            this.fetch(UNISWAP_SUBGRAPH_URL[chainId as keyof typeof UNISWAP_SUBGRAPH_URL].v2, {
                method: 'POST',
                body: JSON.stringify({ query: v2Query })
            }).then(r => r.json()),
            this.fetch(UNISWAP_SUBGRAPH_URL[chainId as keyof typeof UNISWAP_SUBGRAPH_URL].v3, {
                method: 'POST',
                body: JSON.stringify({ query: v3Query })
            }).then(r => r.json())
        ]);

        return {
            v2: v2Pools.data.pairs,
            v3: v3Pools.data.pools
        };
    }

    async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
        const { chainId, fromToken, toToken, amount } = request;

        // 1. Get pools from subgraph
        const pools = await this.getPoolsFromSubgraph(chainId, fromToken, toToken);

        // 2. Find best routes using pools
        const routes = this.computeRoutes(pools, fromToken, toToken);

        // // 3. Get quotes for routes using Quoter contract
        const quoterContract = createContract(
            MIXED_ROUTE_QUOTER_V1_ABI,
            this.getProvider(chainId),
            UNISWAP_MIXED_ROUTE_QUOTER_ADDRESSES[chainId as keyof typeof UNISWAP_MIXED_ROUTE_QUOTER_ADDRESSES]
        );

        const quotes = await Promise.all(
            routes.map(route =>
                this.getQuoteForRoute(quoterContract, route, amount)
            )
        );
        // // 4. Select best quote
        const bestQuote = this.selectBestQuote(quotes);

        return {
            provider: 'uniswap',
            chainId,
            srcToken: await this.fetchTokenInfo(chainId, fromToken),
            dstToken: await this.fetchTokenInfo(chainId, toToken),
            fromAmount: amount,
            dstAmount: bestQuote.amountOut,
            protocols: [bestQuote.route], // 'v2' or 'v3'
            gas: bestQuote.gasEstimate
        };
    }

    private async fetchTokenInfo(chainId: string, address: string): Promise<TokenInfo> {

        const provider = this.getProvider(chainId);
        const contract = createContract(ERC20_ABI, provider, address);

        // Call the contract's methods to retrieve token information.
        // Using Promise.all here so the calls run concurrently.
        const [symbol, name, decimals] = await Promise.all([
            contract.symbol.call(),
            contract.name.call(),
            contract.decimals.call()
        ]);
        // Return the token info in the expected format
        return {
            address,
            symbol,
            name,
            decimals: Number(decimals),
        };
    }

    private computeRoutes(
        pools: { v2: Omit<Pool, 'type'>[]; v3: Omit<Pool, 'type'>[] },
        fromToken: string,
        toToken: string,
        maxHops = 3
    ): Route[] {
        // Convert raw pool data to normalized format
        const normalizedPools: Pool[] = [
            ...pools.v2.map(p => ({
                ...p,
                type: 'v2' as const
            })),
            ...pools.v3.map(p => ({
                ...p,
                type: 'v3' as const
            }))
        ];

        const routes: Route[] = [];
        const visited = new Set<string>();

        // Recursive function to find paths
        const findPath = (
            currentToken: string,
            path: string[] = [],
            poolPath: Pool[] = []
        ) => {
            // Base case - found path to destination
            if (currentToken.toLowerCase() === toToken.toLowerCase()) {
                routes.push({
                    pools: [...poolPath],
                    path: [...path, currentToken],
                });
                return;
            }

            // Stop if max hops reached
            if (poolPath.length >= maxHops) return;

            // Find all pools that contain current token
            const possiblePools = normalizedPools.filter(pool => {
                const token0Lower = pool.token0.id.toLowerCase();
                const token1Lower = pool.token1.id.toLowerCase();
                return (token0Lower === currentToken.toLowerCase() ||
                    token1Lower === currentToken.toLowerCase()) &&
                    !visited.has(pool.id);
            });

            // Explore each pool
            for (const pool of possiblePools) {
                visited.add(pool.id);

                const nextToken = pool.token0.id.toLowerCase() === currentToken.toLowerCase()
                    ? pool.token1.id
                    : pool.token0.id;

                findPath(
                    nextToken,
                    [...path, currentToken],
                    [...poolPath, pool]
                );

                visited.delete(pool.id);
            }
        };

        findPath(fromToken.toLowerCase());
        return routes;
    }

    private async getQuoteForRoute(
        quoterContract: ReturnType<typeof createContract>,
        route: Route,
        amountIn: string
    ): Promise<{
        route: Route;
        amountOut: string;
        gasEstimate: string;
    }> {
        try {
            const encodedPath = this.encodePath(route);

            // Convert hex string to Uint8Array for the bytes parameter
            const pathBytes = new Uint8Array(
                encodedPath
                    .slice(2) // Remove '0x' prefix
                    .match(/.{1,2}/g)! // Split into 2-char chunks
                    .map(byte => parseInt(byte, 16))
            );

            const callResult = await (quoterContract as { quoteExactInput: { call: (args: { path: Uint8Array; amountIn: bigint }) => Promise<{ amountOut: bigint; gasEstimate: bigint }> } }).quoteExactInput.call({
                path: pathBytes,
                amountIn: BigInt(amountIn)
            });
            return {
                route,
                amountOut: callResult.amountOut.toString(),
                gasEstimate: callResult.gasEstimate.toString(),
            };
        } catch (error) {
            console.error('Quote error details:', {
                route: JSON.stringify(route),
                error: error,
            });
            throw new Error(`Quote failed: ${error}`);
        }
    }

    private encodePath(route: Route): string {
        if (!route.pools || route.pools.length === 0) {
            throw new Error('Invalid route: no pools');
        }

        const [tokenIn, tokenOut] = route.path;
        const pool = route.pools[0];

        // Remove '0x' and lowercase all addresses
        const tokenInEncoded = tokenIn.slice(2).toLowerCase();
        const tokenOutEncoded = tokenOut.slice(2).toLowerCase();

        // Encode fee - must be exactly 3 bytes (6 hex chars)
        let feeHex: string;
        if (pool.type === 'v2') {
            feeHex = '800000'; // Special V2 fee marker
        } else {
            // For V3, convert fee to hex and pad to 6 characters
            const fee = Number(pool.feeTier);
            feeHex = fee.toString(16).padStart(6, '0');
        }

        // Combine everything with 0x prefix
        const encodedPath = `0x${tokenInEncoded}${feeHex}${tokenOutEncoded}`;

        return encodedPath;
    }



    private selectBestQuote(quotes: Array<{
        route: Route;
        amountOut: string;
        gasEstimate: string;
        priceImpact?: string;
    }>): {
        route: Route;
        amountOut: string;
        gasEstimate: string;
        priceImpact?: string;
    } {
        // Filter out failed quotes
        const validQuotes = quotes.filter(q => q !== null);

        if (validQuotes.length === 0) {
            throw new Error('No valid quotes found');
        }

        // Sort by output amount considering gas costs
        // We could make this more sophisticated by converting gas costs to token amounts
        return validQuotes.reduce((best, current) => {
            const bestAmount = BigInt(best.amountOut);
            const currentAmount = BigInt(current.amountOut);

            // Simple comparison just using amounts
            if (currentAmount > bestAmount) {
                return current;
            }
            return best;
        });
    }

}