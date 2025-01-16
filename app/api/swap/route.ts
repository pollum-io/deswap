// app/api/swap/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OneInchProvider } from '../../../lib/providers/1inch';
import { SwapRequest } from '../../../types';
import { SUPPORTED_CHAINS } from '../../../config/constants';
import { addr } from 'micro-eth-signer';

export const config = {
    runtime: 'edge',
    regions: ['iad1'], // US East (N. Virginia)
};

const oneInchProvider = new OneInchProvider();

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getProvider(chainId: string) {
    if (!(chainId in SUPPORTED_CHAINS)) {
        throw new Error('Unsupported chain ID');
    }

    switch (chainId) {
        case '1':     // ethereum
        case '56':    // bsc
        case '137':   // polygon
        case '10':    // optimism
        case '42161': // arbitrum
        case '43114': // avalanche
        case '100':   // gnosis
        case '8453':  // base
        case '324':   // zksync
            return oneInchProvider;
        default:
            throw new Error('Unsupported chain ID');
    }
}

function validateSlippage(slippage: string): boolean {
    try {
        const slippageValue = parseFloat(slippage);
        return slippageValue > 0 && slippageValue <= 50; // Allow 0.01% to 50% slippage
    } catch {
        return false;
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const swapRequest: SwapRequest = {
            chainId: searchParams.get('chainId') || '',
            fromToken: searchParams.get('fromToken') || '',
            toToken: searchParams.get('toToken') || '',
            amount: searchParams.get('amount') || '',
            userAddress: searchParams.get('userAddress') || '',
            slippage: searchParams.get('slippage') || '',
        };

        // Validate required parameters
        if (!swapRequest.chainId) {
            return NextResponse.json(
                { error: 'Chain ID is required' },
                { status: 400, headers: corsHeaders }
            );
        }
        if (!swapRequest.fromToken) {
            return NextResponse.json(
                { error: 'From token address is required' },
                { status: 400, headers: corsHeaders }
            );
        }
        if (!swapRequest.toToken) {
            return NextResponse.json(
                { error: 'To token address is required' },
                { status: 400, headers: corsHeaders }
            );
        }
        if (!swapRequest.amount) {
            return NextResponse.json(
                { error: 'Amount is required' },
                { status: 400, headers: corsHeaders }
            );
        }
        if (!swapRequest.userAddress) {
            return NextResponse.json(
                { error: 'User address is required' },
                { status: 400, headers: corsHeaders }
            );
        }
        if (!swapRequest.slippage) {
            return NextResponse.json(
                { error: 'Slippage is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Validate user address format
        if (!addr.isValid(swapRequest.userAddress)) {
            return NextResponse.json(
                { error: 'Invalid user address format' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Validate slippage value
        if (!validateSlippage(swapRequest.slippage)) {
            return NextResponse.json(
                { error: 'Invalid slippage value. Must be between 0.01 and 50' },
                { status: 400, headers: corsHeaders }
            );
        }

        const provider = getProvider(swapRequest.chainId);
        const swap = await provider.getSwap(swapRequest);

        return NextResponse.json(swap, {
            status: 200,
            headers: corsHeaders
        });
    } catch (error) {
        console.error('Swap error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            },
            {
                status: error instanceof Error && error.message.includes('Invalid') ? 400 : 500,
                headers: corsHeaders
            }
        );
    }
}