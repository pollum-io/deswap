import { ftch, jsonrpc } from 'micro-ftch';
import { QuoteRequest, QuoteResponse, TokenInfo, Route, Pool, PoolsByType, CandidatePools } from '@/types';
import { addr } from 'micro-eth-signer';
import { createContract } from 'micro-eth-signer/abi';
import { Web3Provider } from 'micro-eth-signer/net';
import { BASE_TOKENS, ERC20_ABI, MIN_RESERVE_USD, MIXED_ROUTE_QUOTER_V1_ABI, MULTICALL_ABI, MULTICALL_ADDRESSES, RPCS, UNISWAP_MIXED_ROUTE_QUOTER_ADDRESSES, UNISWAP_SUBGRAPH_URL } from '@/config/constants';

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

    private async getPoolsFromSubgraph(
        chainId: string,
        fromToken: string,
        toToken: string
    ): Promise<CandidatePools> {
        const baseTokens = BASE_TOKENS[chainId as keyof typeof BASE_TOKENS] || [];
        const allTokens = [
            fromToken.toLowerCase(),
            toToken.toLowerCase(),
            ...baseTokens.map(t => t.toLowerCase())
        ];

        // Query for V2 pools including base tokens
        const v2Query = `{
            pairs(
                where: {
                    token0_in: [${allTokens.map(t => `"${t}"`).join(', ')}],
                    token1_in: [${allTokens.map(t => `"${t}"`).join(', ')}]
                },
                orderBy: reserveUSD,
                orderDirection: desc,
                first: 1000
            ) {
                id
                token0 { 
                    id 
                    name 
                    symbol 
                    decimals 
                }
                token1 { 
                    id 
                    name 
                    symbol 
                    decimals 
                }
                reserve0
                reserve1
                reserveUSD
            }
        }`;

        // Query for V3 pools including base tokens
        const v3Query = `{
            pools(
                where: {
                    token0_in: [${allTokens.map(t => `"${t}"`).join(', ')}],
                    token1_in: [${allTokens.map(t => `"${t}"`).join(', ')}]
                },
                orderBy: totalValueLockedUSD,
                orderDirection: desc,
                first: 1000
            ) {
                id
                token0 {
                    id
                    name
                    symbol
                    decimals
                }
                token1 {
                    id
                    name
                    symbol
                    decimals
                }
                feeTier
                sqrtPrice
                liquidity
                tick
                totalValueLockedUSD
            }
        }`;

        // Execute queries
        const [v2PoolsRaw, v3PoolsRaw] = await Promise.all([
            this.fetch(UNISWAP_SUBGRAPH_URL[chainId as keyof typeof UNISWAP_SUBGRAPH_URL].v2, {
                method: 'POST',
                body: JSON.stringify({ query: v2Query })
            }).then(r => r.json()),
            this.fetch(UNISWAP_SUBGRAPH_URL[chainId as keyof typeof UNISWAP_SUBGRAPH_URL].v3, {
                method: 'POST',
                body: JSON.stringify({ query: v3Query })
            }).then(r => r.json())
        ]);

        // Filter and normalize pools
        const v2Pools = this.filterAndSortPools(v2PoolsRaw.data.pairs, chainId, 'v2');
        const v3Pools = this.filterAndSortPools(v3PoolsRaw.data.pools, chainId, 'v3');

        // Categorize pools
        return this.categorizePools(
            chainId,
            { v2: v2Pools, v3: v3Pools },
            fromToken,
            toToken,
            baseTokens
        );
    }

    private filterAndSortPools(
        pools: Pool[],
        chainId: string,
        protocolType: 'v2' | 'v3'
    ): Pool[] {
        const minLiquidity = MIN_RESERVE_USD[chainId as keyof typeof MIN_RESERVE_USD];

        // Filter pools based on criteria
        return pools
            .filter(pool => {
                // Get liquidity based on protocol type
                const liquidityUSD = protocolType === 'v2'
                    ? Number(pool.reserveUSD)
                    : Number(pool.totalValueLockedUSD);

                // Basic liquidity check
                if (liquidityUSD < minLiquidity) {
                    return false;
                }

                // V3 specific checks
                if (protocolType === 'v3') {
                    // Filter out pools with zero liquidity
                    if (!pool.liquidity || pool.liquidity === '0') {
                        return false;
                    }

                    // Check for active price range
                    if (!pool.tick) {
                        return false;
                    }

                    // Filter out low liquidity pools
                    if (liquidityUSD < minLiquidity * 2) {
                        return false;
                    }
                }

                // V2 specific checks
                if (protocolType === 'v2') {
                    // Check for minimum reserves
                    if (!pool.reserve0 || !pool.reserve1 ||
                        pool.reserve0 === '0' ||
                        pool.reserve1 === '0') {
                        return false;
                    }
                }

                return true;
            })
            .sort((a, b) => {
                // Primary sort by liquidity
                const liquidityA = protocolType === 'v2'
                    ? Number(a.reserveUSD)
                    : Number(a.totalValueLockedUSD);
                const liquidityB = protocolType === 'v2'
                    ? Number(b.reserveUSD)
                    : Number(b.totalValueLockedUSD);

                // V3 specific sorting
                if (protocolType === 'v3') {
                    // Prefer lower fee tiers for similar liquidity
                    if (Math.abs(liquidityB - liquidityA) < minLiquidity) {
                        return Number(a.feeTier) - Number(b.feeTier);
                    }
                }

                return liquidityB - liquidityA;
            });
    }

    private categorizePools(
        chainId: string,
        pools: PoolsByType,
        tokenInAddress: string,
        tokenOutAddress: string,
        baseTokens: string[]
    ): CandidatePools {
        const allPools = [...pools.v2, ...pools.v3];
        const minLiquidity = MIN_RESERVE_USD[chainId as keyof typeof MIN_RESERVE_USD];
        const poolsUsed = new Set<string>();

        // Helper functions
        const poolContainsToken = (pool: Pool, token: string) =>
            pool.token0.id.toLowerCase() === token.toLowerCase() ||
            pool.token1.id.toLowerCase() === token.toLowerCase();

        const getPoolLiquidity = (pool: Pool) =>
            pool.type === 'v2' ? Number(pool.reserveUSD) : Number(pool.totalValueLockedUSD);

        const addToPoolsUsed = (pools: Pool[]) => {
            pools.forEach(pool => poolsUsed.add(pool.id));
            return pools;
        };

        const getOtherToken = (pool: Pool, token: string): string => {
            const tokenLower = token.toLowerCase();
            return pool.token0.id.toLowerCase() === tokenLower
                ? pool.token1.id
                : pool.token0.id;
        };

        // 1. Direct Swap Pools (highest priority)
        const topByDirectSwapPool = addToPoolsUsed(
            allPools
                .filter(pool =>
                    !poolsUsed.has(pool.id) &&
                    poolContainsToken(pool, tokenInAddress) &&
                    poolContainsToken(pool, tokenOutAddress) &&
                    getPoolLiquidity(pool) >= minLiquidity
                )
                .sort((a, b) => getPoolLiquidity(b) - getPoolLiquidity(a))
                .slice(0, 2) // Take top 2 direct pools
        );

        // 2. Base Token Pools for Input Token
        const topByBaseWithTokenIn = addToPoolsUsed(
            allPools
                .filter(pool =>
                    !poolsUsed.has(pool.id) &&
                    poolContainsToken(pool, tokenInAddress) &&
                    baseTokens.some(baseToken => poolContainsToken(pool, baseToken)) &&
                    getPoolLiquidity(pool) >= minLiquidity * 2
                )
                .sort((a, b) => getPoolLiquidity(b) - getPoolLiquidity(a))
                .slice(0, 5) // Top 5 pools per base token
        );

        // 3. Base Token Pools for Output Token
        const topByBaseWithTokenOut = addToPoolsUsed(
            allPools
                .filter(pool =>
                    !poolsUsed.has(pool.id) &&
                    poolContainsToken(pool, tokenOutAddress) &&
                    baseTokens.some(baseToken => poolContainsToken(pool, baseToken)) &&
                    getPoolLiquidity(pool) >= minLiquidity * 2
                )
                .sort((a, b) => getPoolLiquidity(b) - getPoolLiquidity(a))
                .slice(0, 5)
        );

        // 4. Top Pools by TVL
        const topByTVL = addToPoolsUsed(
            allPools
                .filter(pool =>
                    !poolsUsed.has(pool.id) &&
                    getPoolLiquidity(pool) >= minLiquidity * 3
                )
                .sort((a, b) => getPoolLiquidity(b) - getPoolLiquidity(a))
                .slice(0, 5)
        );

        // 5. Top Pools Using Input Token
        const topByTVLUsingTokenIn = addToPoolsUsed(
            allPools
                .filter(pool =>
                    !poolsUsed.has(pool.id) &&
                    poolContainsToken(pool, tokenInAddress) &&
                    getPoolLiquidity(pool) >= minLiquidity
                )
                .sort((a, b) => getPoolLiquidity(b) - getPoolLiquidity(a))
                .slice(0, 3)
        );

        // 6. Top Pools Using Output Token
        const topByTVLUsingTokenOut = addToPoolsUsed(
            allPools
                .filter(pool =>
                    !poolsUsed.has(pool.id) &&
                    poolContainsToken(pool, tokenOutAddress) &&
                    getPoolLiquidity(pool) >= minLiquidity
                )
                .sort((a, b) => getPoolLiquidity(b) - getPoolLiquidity(a))
                .slice(0, 3)
        );

        // 7. Second Hop Pools from Input Token
        const topByTVLUsingTokenInSecondHops = addToPoolsUsed(
            topByTVLUsingTokenIn.flatMap(firstHopPool => {
                const secondHopToken = getOtherToken(firstHopPool, tokenInAddress);
                return allPools
                    .filter(pool =>
                        !poolsUsed.has(pool.id) &&
                        poolContainsToken(pool, secondHopToken) &&
                        getPoolLiquidity(pool) >= minLiquidity
                    )
                    .slice(0, 2); // Top 2 pools per second hop token
            })
        );

        // 8. Second Hop Pools to Output Token
        const topByTVLUsingTokenOutSecondHops = addToPoolsUsed(
            topByTVLUsingTokenOut.flatMap(firstHopPool => {
                const secondHopToken = getOtherToken(firstHopPool, tokenOutAddress);
                return allPools
                    .filter(pool =>
                        !poolsUsed.has(pool.id) &&
                        poolContainsToken(pool, secondHopToken) &&
                        getPoolLiquidity(pool) >= minLiquidity
                    )
                    .slice(0, 2);
            })
        );

        return {
            topByDirectSwapPool,
            topByBaseWithTokenIn,
            topByBaseWithTokenOut,
            topByTVL,
            topByTVLUsingTokenIn,
            topByTVLUsingTokenOut,
            topByTVLUsingTokenInSecondHops,
            topByTVLUsingTokenOutSecondHops
        };
    }

    async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
        const { chainId, fromToken, toToken, amount } = request;

        // Get pools and compute routes
        const pools = await this.getPoolsFromSubgraph(chainId, fromToken, toToken);
        const routes = this.computeRoutes(pools, fromToken, toToken);

        // Get token info and quotes in parallel
        const [tokenInfos, quotes] = await Promise.all([
            this.fetchTokenInfo(chainId, [fromToken, toToken]),
            this.getQuoteForRoute(chainId, routes, amount)
        ]);

        // Select best quote
        const bestQuote = this.selectBestQuote(quotes);

        // Get tokens from results
        const [srcToken, dstToken] = tokenInfos;

        return {
            provider: 'uniswap',
            chainId,
            srcToken,
            dstToken,
            fromAmount: amount,
            dstAmount: bestQuote.amountOut,
            protocols: [bestQuote.route],
            gas: bestQuote.gasEstimate
        };
    }

    private async fetchTokenInfo(chainId: string, addresses: string[]): Promise<TokenInfo[]> {
        const provider = this.getProvider(chainId);
        const multicallContract = createContract(MULTICALL_ABI, provider, MULTICALL_ADDRESSES[chainId as keyof typeof MULTICALL_ADDRESSES]);
        const tokenContract = createContract(ERC20_ABI);

        const calls = addresses.flatMap(address => [
            {
                target: address,
                callData: tokenContract.symbol.encodeInput()
            },
            {
                target: address,
                callData: tokenContract.name.encodeInput()
            },
            {
                target: address,
                callData: tokenContract.decimals.encodeInput()
            }
        ]);

        const { returnData } = await multicallContract.aggregate.call(calls);

        const tokenInfos: TokenInfo[] = [];

        for (let i = 0; i < addresses.length; i++) {
            const address = addresses[i];
            const startIdx = i * 3;

            try {
                const symbolData = returnData[startIdx];
                const nameData = returnData[startIdx + 1];
                const decimalsData = returnData[startIdx + 2];

                const symbol = tokenContract.symbol.decodeOutput(symbolData) as string;
                const name = tokenContract.name.decodeOutput(nameData) as string;
                const decimals = Number(tokenContract.decimals.decodeOutput(decimalsData));

                tokenInfos.push({
                    address,
                    symbol,
                    name,
                    decimals
                });
            } catch (error) {
                console.error(`Failed to decode token info for ${address}:`, error);
                tokenInfos.push({ address });
            }
        }

        return tokenInfos;
    }

    private computeRoutes(
        candidatePools: CandidatePools,
        fromToken: string,
        toToken: string,
        maxHops = 4
    ): Route[] {
        const routes: Route[] = [];
        const visited = new Set<string>();
        const fromTokenLower = fromToken.toLowerCase();
        const toTokenLower = toToken.toLowerCase();

        // Helper to get all relevant pools for path building
        const getAllRelevantPools = (): Pool[] => {
            const poolSet = new Set<Pool>();

            // 1. Direct pools (highest priority)
            candidatePools.topByDirectSwapPool.forEach(pool => poolSet.add(pool));

            // 2. Base token pools for first hop
            if (poolSet.size === 0 || maxHops > 1) {
                candidatePools.topByBaseWithTokenIn.forEach(pool => poolSet.add(pool));
                candidatePools.topByBaseWithTokenOut.forEach(pool => poolSet.add(pool));
            }

            // 3. High liquidity pools for input/output tokens
            candidatePools.topByTVLUsingTokenIn.forEach(pool => poolSet.add(pool));
            candidatePools.topByTVLUsingTokenOut.forEach(pool => poolSet.add(pool));

            // 4. Second hop pools (only if max hops > 1)
            if (maxHops > 1) {
                candidatePools.topByTVLUsingTokenInSecondHops.forEach(pool => poolSet.add(pool));
                candidatePools.topByTVLUsingTokenOutSecondHops.forEach(pool => poolSet.add(pool));
            }

            return Array.from(poolSet);
        };

        const relevantPools = getAllRelevantPools();

        // Helper to get pool liquidity
        const getPoolLiquidity = (pool: Pool): number => {
            return pool.type === 'v2'
                ? Number(pool.reserveUSD)
                : Number(pool.totalValueLockedUSD);
        };

        const findPath = (
            currentToken: string,
            currentPath: string[] = [],
            poolPath: Pool[] = [],
            remainingHops: number = maxHops
        ) => {
            // Found valid path
            if (currentToken === toTokenLower) {
                if (poolPath.length > 0) { // Only add if path contains at least one pool
                    routes.push({
                        pools: [...poolPath],
                        path: [...currentPath, currentToken],
                    });
                }
                return;
            }

            // Stop if max hops reached
            if (remainingHops === 0) return;

            // Find pools for next hop
            const possiblePools = relevantPools.filter(pool => {
                // Skip if pool already used
                if (visited.has(pool.id)) return false;

                const token0Lower = pool.token0.id.toLowerCase();
                const token1Lower = pool.token1.id.toLowerCase();

                // Must connect to current token
                if (token0Lower !== currentToken && token1Lower !== currentToken) {
                    return false;
                }

                const otherToken = token0Lower === currentToken ? token1Lower : token0Lower;

                // For last hop, must connect to destination
                if (remainingHops === 1 && otherToken !== toTokenLower) {
                    return false;
                }

                return true;
            });

            // Sort pools by liquidity for better paths first
            const sortedPools = possiblePools.sort((a, b) =>
                getPoolLiquidity(b) - getPoolLiquidity(a)
            );

            // Explore each pool
            for (const pool of sortedPools) {
                visited.add(pool.id);

                const nextToken = pool.token0.id.toLowerCase() === currentToken
                    ? pool.token1.id.toLowerCase()
                    : pool.token0.id.toLowerCase();

                findPath(
                    nextToken,
                    [...currentPath, currentToken],
                    [...poolPath, pool],
                    remainingHops - 1
                );

                visited.delete(pool.id);
            }
        };

        // Start path finding from input token
        findPath(fromTokenLower);

        // Sort routes by total liquidity
        return routes.sort((a, b) => {
            const liquidityA = a.pools.reduce((sum, pool) => sum + getPoolLiquidity(pool), 0);
            const liquidityB = b.pools.reduce((sum, pool) => sum + getPoolLiquidity(pool), 0);
            return liquidityB - liquidityA;
        });
    }

    private async getQuoteForRoute(
        chainId: string,
        routes: Route[],
        amountIn: string
    ): Promise<Array<{
        route: Route;
        amountOut: string;
        gasEstimate: string;
    }>> {
        const provider = this.getProvider(chainId);

        const quoterContract = createContract(
            MIXED_ROUTE_QUOTER_V1_ABI,
            provider,
            UNISWAP_MIXED_ROUTE_QUOTER_ADDRESSES[chainId as keyof typeof UNISWAP_MIXED_ROUTE_QUOTER_ADDRESSES]
        );

        const multicallContract = createContract(
            MULTICALL_ABI,
            provider,
            MULTICALL_ADDRESSES[chainId as keyof typeof MULTICALL_ADDRESSES]
        );

        // Prepare all paths for batch processing
        const calls = routes.map(route => {
            const encodedPath = this.encodePath(route);
            const pathBytes = new Uint8Array(
                encodedPath
                    .slice(2)
                    .match(/.{1,2}/g)!
                    .map(byte => parseInt(byte, 16))
            );

            // Encode the quote function call with proper object structure
            return {
                target: UNISWAP_MIXED_ROUTE_QUOTER_ADDRESSES[chainId as keyof typeof UNISWAP_MIXED_ROUTE_QUOTER_ADDRESSES],
                callData: quoterContract.quoteExactInput.encodeInput({
                    path: pathBytes,
                    amountIn: BigInt(amountIn)
                })
            };
        });

        // Make multicall
        const { returnData } = await multicallContract.aggregate.call(calls);

        // Process results
        return routes.map((route, i) => {
            try {
                const decodedResult = quoterContract.quoteExactInput.decodeOutput(returnData[i]);
                return {
                    route,
                    amountOut: decodedResult.amountOut.toString(),
                    gasEstimate: decodedResult.gasEstimate.toString()
                };
            } catch (error) {
                console.error('Quote error details:', {
                    route: JSON.stringify(route),
                    error: error,
                });
                return null;
            }
        }).filter((quote): quote is NonNullable<typeof quote> => quote !== null);
    }

    private encodePath(route: Route): string {
        if (!route.pools || route.pools.length === 0) {
            throw new Error('Invalid route: no pools');
        }

        let path = '';

        // Loop through all tokens in the path except the last one
        for (let i = 0; i < route.path.length - 1; i++) {
            const tokenIn = route.path[i];
            const pool = route.pools[i];

            // Remove '0x' and lowercase address
            const tokenInEncoded = tokenIn.slice(2).toLowerCase();

            // Add token to path
            path += tokenInEncoded;

            // Encode fee for this hop
            let feeHex: string;
            if (pool.type === 'v2') {
                feeHex = '800000'; // Special V2 fee marker
            } else {
                // For V3, convert fee to hex and pad to 6 characters
                const fee = Number(pool.feeTier);
                feeHex = fee.toString(16).padStart(6, '0');
            }

            // Add fee to path
            path += feeHex;
        }

        // Add final token
        const finalToken = route.path[route.path.length - 1];
        path += finalToken.slice(2).toLowerCase();

        // Add 0x prefix to complete path
        return `0x${path}`;
    }

    private selectBestQuote(quotes: Array<{
        route: Route;
        amountOut: string;
        gasEstimate: string;
    }>): {
        route: Route;
        amountOut: string;
        gasEstimate: string;
    } {
        // Filter out failed quotes
        const validQuotes = quotes.filter(q => q !== null && BigInt(q.amountOut) > 0);

        if (validQuotes.length === 0) {
            throw new Error('No valid quotes found');
        }

        // Helper to calculate route score
        const calculateRouteScore = (quote: typeof validQuotes[0]) => {
            const amount = BigInt(quote.amountOut);
            const gas = BigInt(quote.gasEstimate);

            // Calculate liquidity score
            const liquidityScore = quote.route.pools.reduce((score, pool) => {
                const poolLiquidity = pool.type === 'v2'
                    ? Number(pool.reserveUSD)
                    : Number(pool.totalValueLockedUSD);
                return score + Math.log10(poolLiquidity); // Use log scale for liquidity
            }, 0);

            // Combined score calculation
            // Higher score is better
            const score = {
                outputAmount: amount,
                gasAmount: gas,
                liquidityScore: liquidityScore
            };

            return score;
        };

        // Sort quotes by multiple criteria
        return validQuotes.reduce((best, current) => {
            const bestScore = calculateRouteScore(best);
            const currentScore = calculateRouteScore(current);

            // If the difference in output amounts is less than 0.1%
            const outputDiffPercent = Math.abs(
                Number(currentScore.outputAmount - bestScore.outputAmount) /
                Number(bestScore.outputAmount)
            );

            if (outputDiffPercent < 0.001) {
                // If outputs are very close, consider other factors

                // If current route has significantly better liquidity (20% better)
                if (currentScore.liquidityScore > bestScore.liquidityScore * 1.2) {
                    return current;
                }

                // If current route has significantly better gas costs (30% better)
                if (currentScore.gasAmount > bestScore.gasAmount * BigInt(130) / BigInt(100)) {
                    return current;
                }

                // Prefer simpler routes when other factors are similar
                if (current.route.pools.length < best.route.pools.length &&
                    currentScore.gasAmount >= bestScore.gasAmount * BigInt(95) / BigInt(100)) {
                    return current;
                }
            } else {
                // If outputs are notably different, take the higher output
                if (currentScore.outputAmount > bestScore.outputAmount) {
                    return current;
                }
            }

            return best;
        });
    }

}