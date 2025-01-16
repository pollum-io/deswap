// app/api/quote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OneInchProvider } from '../../../lib/providers/1inch';
import { QuoteRequest } from '../../../types';
import { SUPPORTED_CHAINS } from '../../../config/constants';

export const runtime = 'edge';
export const region = 'iad1'; // US East (N. Virginia)
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

export async function OPTIONS() {
    return new NextResponse(null, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const quoteRequest: QuoteRequest = {
            chainId: searchParams.get('chainId') || '',
            fromToken: searchParams.get('fromToken') || '',
            toToken: searchParams.get('toToken') || '',
            amount: searchParams.get('amount') || '',
        };

        if (!quoteRequest.chainId) {
            return NextResponse.json(
                { error: 'Chain ID is required' },
                {
                    status: 400,
                    headers: corsHeaders
                }
            );
        }
        if (!quoteRequest.fromToken) {
            return NextResponse.json(
                { error: 'From token address is required' },
                {
                    status: 400,
                    headers: corsHeaders
                }
            );
        }
        if (!quoteRequest.toToken) {
            return NextResponse.json(
                { error: 'To token address is required' },
                {
                    status: 400,
                    headers: corsHeaders
                }
            );
        }
        if (!quoteRequest.amount) {
            return NextResponse.json(
                { error: 'Amount is required' },
                {
                    status: 400,
                    headers: corsHeaders
                }
            );
        }

        const provider = getProvider(quoteRequest.chainId);
        const quote = await provider.getQuote(quoteRequest);

        return NextResponse.json(quote, {
            status: 200,
            headers: corsHeaders
        });
    } catch (error) {
        console.error('Quote error:', error);

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