import type { ToolDefinition } from '../types/index';

export interface WebSearchArgs {
  query: string;
  provider?: 'duckduckgo' | 'brave' | 'searx';
  limit?: number;
  safe_search?: 'strict' | 'moderate' | 'off';
  region?: string;
  language?: string;
  time_range?: 'day' | 'week' | 'month' | 'year';
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published_date?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total_results?: number;
  search_time?: number;
  provider: string;
}

async function searchDuckDuckGo(query: string, options: Partial<WebSearchArgs>): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    skip_disambig: '1',
  });

  if (options.safe_search === 'strict') params.set('safe', 'on');
  if (options.region) params.set('kl', options.region);
  if (options.language) params.set('hl', options.language);

  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Harness/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed: ${response.status}`);
    }

    const html = await response.text();
    
    // Parse HTML results (simple regex-based parsing)
    const results: SearchResult[] = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/gs;
    
    let match;
    let count = 0;
    const limit = options.limit || 10;
    
    while ((match = resultRegex.exec(html)) && count < limit) {
      const [, url, title, snippet] = match;
      results.push({
        title: title.replace(/<[^>]*>/g, '').trim(),
        url: url.startsWith('//') ? `https:${url}` : url,
        snippet: snippet.replace(/<[^>]*>/g, '').trim(),
      });
      count++;
    }

    return {
      results,
      provider: 'duckduckgo',
    };
  } catch (error) {
    throw new Error(`DuckDuckGo search error: ${(error as Error).message}`);
  }
}

async function searchBrave(query: string, options: Partial<WebSearchArgs>): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
  });

  if (options.safe_search === 'strict') params.set('safesearch', 'strict');
  if (options.region) params.set('country', options.region);
  if (options.language) params.set('lang', options.language);

  try {
    const response = await fetch(`https://search.brave.com/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Harness/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Brave search failed: ${response.status}`);
    }

    const html = await response.text();
    
    // Parse HTML results
    const results: SearchResult[] = [];
    const resultRegex = /<a[^>]*data-type="web"[^>]*href="([^"]*)"[^>]*>.*?<div[^>]*class="title"[^>]*>([^<]*)<\/div>.*?<div[^>]*class="snippet"[^>]*>([^<]*)<\/div>/gs;
    
    let match;
    let count = 0;
    const limit = options.limit || 10;
    
    while ((match = resultRegex.exec(html)) && count < limit) {
      const [, url, title, snippet] = match;
      results.push({
        title: title.replace(/<[^>]*>/g, '').trim(),
        url,
        snippet: snippet.replace(/<[^>]*>/g, '').trim(),
      });
      count++;
    }

    return {
      results,
      provider: 'brave',
    };
  } catch (error) {
    throw new Error(`Brave search error: ${(error as Error).message}`);
  }
}

async function searchSearX(query: string, options: Partial<WebSearchArgs>): Promise<SearchResponse> {
  // Use a public SearX instance
  const baseUrl = 'https://searx.be';
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    engines: 'google,duckduckgo,brave,qwant',
  });

  if (options.safe_search === 'strict') params.set('safesearch', '1');
  if (options.language) params.set('language', options.language);
  if (options.time_range) params.set('time_range', options.time_range);

  try {
    const response = await fetch(`${baseUrl}/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Harness/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SearX search failed: ${response.status}`);
    }

    const data = await response.json() as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        publishedDate?: string;
      }>;
      numberOfResults?: number;
    };
    
    const results: SearchResult[] = (data.results || []).slice(0, options.limit || 10).map((item) => ({
      title: item.title || '',
      url: item.url || '',
      snippet: item.content || '',
      published_date: item.publishedDate,
    }));

    return {
      results,
      total_results: data.numberOfResults || results.length,
      provider: 'searx',
    };
  } catch (error) {
    throw new Error(`SearX search error: ${(error as Error).message}`);
  }
}

async function executeWebSearch(args: Record<string, unknown>): Promise<string> {
  const typedArgs = args as unknown as WebSearchArgs;
  const { 
    query, 
    provider = 'duckduckgo', 
    limit = 10, 
    safe_search = 'moderate',
    region,
    language = 'en',
    time_range
  } = typedArgs;

  if (!query || typeof query !== 'string') {
    throw new Error('query is required and must be a string');
  }

  if (limit < 1 || limit > 50) {
    throw new Error('limit must be between 1 and 50');
  }

  const options = { limit, safe_search, region, language, time_range };

  try {
    let searchResponse: SearchResponse;

    switch (provider) {
      case 'duckduckgo':
        searchResponse = await searchDuckDuckGo(query, options);
        break;
      case 'brave':
        searchResponse = await searchBrave(query, options);
        break;
      case 'searx':
        searchResponse = await searchSearX(query, options);
        break;
      default:
        throw new Error(`Unknown search provider: ${provider}`);
    }

    if (searchResponse.results.length === 0) {
      return `No results found for query: "${query}" using ${provider}`;
    }

    let output = `Search results for "${query}" (${provider}):\n\n`;
    
    searchResponse.results.forEach((result, index) => {
      output += `${index + 1}. ${result.title}\n`;
      output += `   URL: ${result.url}\n`;
      output += `   ${result.snippet}\n`;
      if (result.published_date) {
        output += `   Published: ${result.published_date}\n`;
      }
      output += '\n';
    });

    if (searchResponse.total_results) {
      output += `Total results: ${searchResponse.total_results}\n`;
    }

    if (searchResponse.search_time) {
      output += `Search time: ${searchResponse.search_time}s\n`;
    }

    return output.trim();
  } catch (error) {
    const err = error as Error;
    throw new Error(`Web search failed: ${err.message}`);
  }
}

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web for information using multiple search providers (DuckDuckGo, Brave, SearX). Returns relevant web pages with titles, URLs, and snippets.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query string',
      },
      provider: {
        type: 'string',
        enum: ['duckduckgo', 'brave', 'searx'],
        description: 'Search provider to use (default: duckduckgo)',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum number of results to return (default: 10)',
      },
      safe_search: {
        type: 'string',
        enum: ['strict', 'moderate', 'off'],
        description: 'Safe search level (default: moderate)',
      },
      region: {
        type: 'string',
        description: 'Region/country code for localized results (e.g., us, uk, ca)',
      },
      language: {
        type: 'string',
        description: 'Language code (default: en)',
      },
      time_range: {
        type: 'string',
        enum: ['day', 'week', 'month', 'year'],
        description: 'Filter results by time period',
      },
    },
    required: ['query'],
  },
  execute: executeWebSearch,
};
