import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { XSentiment } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { marketQuestion } = await request.json();

    if (!process.env.X_API_BEARER_TOKEN || process.env.X_API_BEARER_TOKEN === 'your_x_api_token_here') {
      // Return neutral sentiment if X API is not configured
      return NextResponse.json({
        marketId: 'unknown',
        sentiment: 'neutral' as const,
        score: 0,
        tweets: 0,
        error: 'X API not configured',
      });
    }

    // Search recent tweets about the market
    const response = await axios.get(
      'https://api.twitter.com/2/tweets/search/recent',
      {
        headers: {
          Authorization: `Bearer ${process.env.X_API_BEARER_TOKEN}`,
        },
        params: {
          query: marketQuestion.substring(0, 100),
          max_results: 10,
          'tweet.fields': 'created_at,public_metrics',
        },
      }
    );

    const tweets = response.data.data || [];

    // Simple sentiment analysis (in production, use more sophisticated NLP)
    const positiveWords = ['yes', 'will', 'definitely', 'bullish', 'win'];
    const negativeWords = ['no', 'won\'t', 'unlikely', 'bearish', 'lose'];

    let sentimentScore = 0;
    tweets.forEach((tweet: any) => {
      const text = tweet.text.toLowerCase();
      positiveWords.forEach(word => {
        if (text.includes(word)) sentimentScore += 1;
      });
      negativeWords.forEach(word => {
        if (text.includes(word)) sentimentScore -= 1;
      });
    });

    const normalizedScore = tweets.length > 0 ? sentimentScore / tweets.length : 0;

    const sentiment: XSentiment = {
      marketId: 'unknown',
      sentiment: normalizedScore > 0 ? 'positive' : normalizedScore < 0 ? 'negative' : 'neutral',
      score: normalizedScore,
      tweets: tweets.length,
    };

    return NextResponse.json(sentiment);
  } catch (error: any) {
    console.error('Error fetching X sentiment:', error);
    return NextResponse.json(
      {
        marketId: 'unknown',
        sentiment: 'neutral' as const,
        score: 0,
        tweets: 0,
        error: error.message
      },
      { status: 200 } // Return neutral sentiment on error
    );
  }
}
