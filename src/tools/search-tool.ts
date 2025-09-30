import { BaseTool, ToolResult, ToolParameters } from './base-tool';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class SearchTool extends BaseTool {
  constructor(private config: Record<string, unknown>) {
    super();
  }

  get name(): string {
    return 'search_web';
  }

  get description(): string {
    return 'Search the web using DuckDuckGo for current information';
  }

  get parameters(): ToolParameters {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find information on the web',
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of search results to return',
          default: 5,
        },
      },
      required: ['query'],
    };
  }

  async execute(query: string, maxResults: number = 5): Promise<ToolResult> {
    try {
      // Use DuckDuckGo search API or scraping
      // For simplicity, using a basic implementation with axios
      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent':
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.config as any).search?.user_agent ||
            'Mozilla/5.0 (compatible; OpenRouter Agent)',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      const results = $('.result').slice(0, maxResults);

      const simplifiedResults = results
        .map((index, element) => {
          const title = $(element).find('.result__title a').text().trim();
          const url = $(element).find('.result__url').attr('href') || '';
          const snippet = $(element).find('.result__snippet').text().trim();

          return {
            title,
            url,
            snippet,
            content: snippet, // Simplified, in production you might fetch full content
          };
        })
        .get();

      return { results: simplifiedResults };
    } catch (error) {
      return { error: `Search failed: ${(error as Error).message}` };
    }
  }
}
