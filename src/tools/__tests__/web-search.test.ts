import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webSearchTool } from '../web-search';

// Mock fetch to avoid actual network calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('webSearchTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate required query parameter', async () => {
    await expect(
      webSearchTool.execute({})
    ).rejects.toThrow('query is required and must be a string');
  });

  it('should validate limit parameter range', async () => {
    await expect(
      webSearchTool.execute({ query: 'test', limit: 0 })
    ).rejects.toThrow('limit must be between 1 and 50');

    await expect(
      webSearchTool.execute({ query: 'test', limit: 51 })
    ).rejects.toThrow('limit must be between 1 and 50');
  });

  it('should use DuckDuckGo by default', async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue('<html></html>'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await webSearchTool.execute({ query: 'test query' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('html.duckduckgo.com/html/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Harness/1.0)',
        }),
      })
    );
  });

  it('should handle DuckDuckGo search with results', async () => {
    const mockHtml = `
      <div class="result">
        <a class="result__a" href="https://example.com">Example Title</a>
        <a class="result__snippet">This is a test snippet</a>
      </div>
    `;
    
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(mockHtml),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await webSearchTool.execute({ query: 'test' });

    expect(result).toContain('Search results for "test" (duckduckgo)');
    expect(result).toContain('Example Title');
    expect(result).toContain('https://example.com');
    expect(result).toContain('This is a test snippet');
  });

  it('should handle Brave search provider', async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue('<html></html>'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await webSearchTool.execute({ query: 'test', provider: 'brave' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('search.brave.com/search'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Harness/1.0)',
        }),
      })
    );
  });

  it('should handle SearX search provider', async () => {
    const mockData = {
      results: [
        {
          title: 'Test Result',
          url: 'https://test.com',
          content: 'Test content',
          publishedDate: '2023-01-01',
        },
      ],
      numberOfResults: 1,
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await webSearchTool.execute({ query: 'test', provider: 'searx' });

    expect(result).toContain('Search results for "test" (searx)');
    expect(result).toContain('Test Result');
    expect(result).toContain('https://test.com');
    expect(result).toContain('Test content');
    expect(result).toContain('Total results: 1');
  });

  it('should handle search with no results', async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue('<html>No results</html>'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await webSearchTool.execute({ query: 'nonexistent' });

    expect(result).toContain('No results found for query: "nonexistent"');
  });

  it('should handle network errors', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
    };
    mockFetch.mockResolvedValue(mockResponse);

    await expect(
      webSearchTool.execute({ query: 'test' })
    ).rejects.toThrow('Web search failed: DuckDuckGo search error: DuckDuckGo search failed: 500');
  });

  it('should handle fetch exceptions', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(
      webSearchTool.execute({ query: 'test' })
    ).rejects.toThrow('Web search failed: DuckDuckGo search error: Network error');
  });

  it('should validate search parameters', async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue('<html></html>'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await webSearchTool.execute({
      query: 'test',
      provider: 'duckduckgo',
      limit: 5,
      safe_search: 'strict',
      region: 'us',
      language: 'en',
      time_range: 'week',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('q=test'),
      expect.any(Object)
    );
  });

  it('should handle unknown provider', async () => {
    await expect(
      webSearchTool.execute({ query: 'test', provider: 'unknown' as any })
    ).rejects.toThrow('Unknown search provider: unknown');
  });

  it('should truncate results based on limit', async () => {
    const mockData = {
      results: Array.from({ length: 20 }, (_, i) => ({
        title: `Result ${i + 1}`,
        url: `https://example${i + 1}.com`,
        content: `Content ${i + 1}`,
      })),
      numberOfResults: 20,
    };

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await webSearchTool.execute({ 
      query: 'test', 
      provider: 'searx', 
      limit: 5 
    });

    expect(result).toContain('Result 1');
    expect(result).toContain('Result 5');
    expect(result).not.toContain('Result 6');
    expect(result).toContain('Total results: 20');
  });
});
