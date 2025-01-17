# DESWAP

A high-performance DEX aggregator API designed for multi-chain token swaps.
Built for Vercel Edge Functions.

## Overview

DESWAP is a TypeScript-based serverless service that aggregates DEX liquidity across multiple blockchain networks to find the best token swap rates. It integrates with various DEX aggregators including 1inch and Jupiter (Solana), providing optimal routing for token swaps.

## Supported Networks

- Ethereum (Chain ID: 1)
- BSC (Chain ID: 56)
- Polygon (Chain ID: 137)
- Optimism (Chain ID: 10)
- Arbitrum (Chain ID: 42161)
- Avalanche (Chain ID: 43114)
- Gnosis (Chain ID: 100)
- Base (Chain ID: 8453)
- ZkSync (Chain ID: 324)
- Solana (Chain ID: 101)

## Features

- Fully serverless/Vercel Edge Functions compatible
- Multi-chain DEX aggregation (EVM + Solana)
- Best price discovery across multiple DEXs
- Edge-optimized performance
- Modular provider system for easy expansion
- Configurable slippage and gas settings
- Type-safe implementation with TypeScript
- Integrated fee system for platform revenue

## Prerequisites

- Node.js >= 16.x
- Vercel account
- 1inch API key (for EVM chains)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/pollum-io/deswap.git
cd deswap
```

2. Install dependencies:

```bash
yarn install
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:

- `ONEINCH_API_KEY`: Your 1inch API key for EVM chains
- `EVM_REFERRER_ADDRESS`: Your Ethereum address for collecting fees on EVM chains
- `SOL_REFERRER_ADDRESS`: Your Solana address for collecting fees on Solana

4. Build the project:

```bash
yarn run build
```

## Vercel

To deploy this to Vercel:

Create environment variables:

```bash
vercel env add ONEINCH_API_KEY
vercel env add EVM_REFERRER_ADDRESS
vercel env add SOL_REFERRER_ADDRESS
```

Deploy:

```bash
vercel deploy
```

## Usage

Start the service:

```bash
yarn start
```

For development:

```bash
yarn run dev
```

## API Endpoints

### GET /api/quote

Returns the best available price for a token swap.

Request parameters:

```typescript
{
  chainId: string; // Blockchain network ID
  fromToken: string; // Token address to swap from
  toToken: string; // Token address to swap to
  amount: string; // Amount in base units (wei for EVM, lamports for Solana)
}
```

Response:

```typescript
{
  provider: string; // '1inch' or 'jupiter'
  chainId: string;
  srcToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  }
  dstToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  }
  fromAmount: string;
  dstAmount: string;
  priceImpactPct: string;
  slippageBps: string;
  protocols: any[];
}
```

### GET /api/swap

Returns the transaction data needed to execute the swap.

Request parameters:

```typescript
{
  chainId: string; // Blockchain network ID
  fromToken: string; // Token address to swap from
  toToken: string; // Token address to swap to
  amount: string; // Amount in base units
  userAddress: string; // User's wallet address
  slippage: string; // Slippage tolerance in percentage (0.01-50)
}
```

Response:

```typescript
{
  provider: string;
  chainId: string;
  srcToken: TokenInfo;
  dstToken: TokenInfo;
  fromAmount: string;
  dstAmount: string;
  from: string;
  data: string;        // Encoded transaction data
  // Optional fields depending on chain
  value?: string;      // For EVM chains
  gasLimit?: string;   // For EVM chains
  gasPrice?: string;   // For EVM chains
  // Solana specific fields
  lastValidBlockHeight?: string;  // For Solana
  priceImpactPct?: string;       // For Solana
  slippageBps?: string;          // For Solana
  protocols: any[];
}
```
