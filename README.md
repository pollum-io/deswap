# DESWAP

A high-performance DEX aggregator API designed for multi-chain token swaps.
Built for Vercel Edge Functions.

## Overview

DESWAP is a TypeScript-based serverless service that aggregates DEX liquidity across multiple blockchain networks to find the best token swap rates. It integrates with various DEX aggregators starting with 1inch, and provides optimal routing for token swaps.

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

## Features

- Fully serverless/Vercel Edge Functions compatible
- multi-chain DEX aggregation
- Best price discovery across multiple DEXs
- Edge-optimized performance
- Modular provider system for easy expansion
- Configurable slippage and gas settings
- Type-safe implementation with TypeScript

## Prerequisites

- Node.js >= 16.x
- Vercel account
- 1inch API key

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

4. Build the project:

```bash
yarn run build
```

## Vercel

To deploy this to Vercel:

Create environment variables:

```bash
vercel env add ONEINCH_API_KEY
vercel env add REFERRER_ADDRESS
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
  amount: string; // Amount in base units (wei)
}
```

Response:

```typescript
{
  provider: string;
  chainId: string;
  srcToken: {
    address: string;
    amount: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  dstToken: {
    address: string;
    amount: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  fromAmount: string;
  dstAmount: string;
  protocols: string[];
  gas: string;
}
```
