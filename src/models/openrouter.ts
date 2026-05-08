import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  ProviderV2,
} from "@ai-sdk/provider";
import { loadApiKey, withoutTrailingSlash } from "@ai-sdk/provider-utils";
import { createOpenAI } from "@ai-sdk/openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpenRouterModelId = string;

export interface OpenRouterProviderSettings {
  /** OpenRouter API key. Defaults to OPENROUTER_API_KEY env var. */
  apiKey?: string;
  /** Base URL for the OpenRouter API. Defaults to https://openrouter.ai/api/v1 */
  baseURL?: string;
  /** Extra headers to send on every request. */
  headers?: Record<string, string>;
}

export interface OpenRouterModelSettings {
  /** Override the base URL per-model (e.g. for self-hosted). */
  baseURL?: string;
}

// ---------------------------------------------------------------------------
// OpenRouterLanguageModel — wraps @ai-sdk/openai LanguageModelV2
// ---------------------------------------------------------------------------

export class OpenRouterLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "openrouter";
  readonly modelId: OpenRouterModelId;
  readonly defaultObjectGenerationMode = "json" as const;
  readonly supportsImageUrls = true;
  readonly supportedUrls: Record<string, RegExp[]> = {
    "image/*": [/data/, /https:\/\//],
  };

  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly openaiModel: ReturnType<ReturnType<typeof createOpenAI>>;

  constructor(
    modelId: OpenRouterModelId,
    providerSettings: OpenRouterProviderSettings,
    modelSettings: OpenRouterModelSettings = {}
  ) {
    this.modelId = modelId;
    this.baseURL = withoutTrailingSlash(
      modelSettings.baseURL ??
        providerSettings.baseURL ??
        "https://openrouter.ai/api/v1"
    ) ?? "https://openrouter.ai/api/v1";

    this.apiKey = loadApiKey({
      apiKey: providerSettings.apiKey,
      environmentVariableName: "OPENROUTER_API_KEY",
      description: "OpenRouter",
    }) ?? "";

    this.defaultHeaders = {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ai-harness.local",
      "X-Title": "AI Harness",
      ...providerSettings.headers,
    };

    // Create the OpenAI model from @ai-sdk/openai
    const openai = createOpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      headers: this.defaultHeaders,
    });

    this.openaiModel = openai(modelId);
  }

  // -----------------------------------------------------------------------
  // doGenerate — non-streaming
  // -----------------------------------------------------------------------

  async doGenerate(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    return this.openaiModel.doGenerate(options);
  }

  // -----------------------------------------------------------------------
  // doStream — streaming
  // -----------------------------------------------------------------------

  async doStream(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    return this.openaiModel.doStream(options);
  }
}

// ---------------------------------------------------------------------------
// OpenRouterProvider — implements ProviderV2
// ---------------------------------------------------------------------------

export interface OpenRouterProvider extends ProviderV2 {
  (modelId: OpenRouterModelId, settings?: OpenRouterModelSettings): OpenRouterLanguageModel;
}

export function createOpenRouter(
  providerSettings: OpenRouterProviderSettings = {}
): OpenRouterProvider {
  const createModel = (
    modelId: OpenRouterModelId,
    modelSettings: OpenRouterModelSettings = {}
  ) => new OpenRouterLanguageModel(modelId, providerSettings, modelSettings);

  const provider = function (
    modelId: OpenRouterModelId,
    settings?: OpenRouterModelSettings
  ) {
    return createModel(modelId, settings);
  } as OpenRouterProvider;

  return provider;
}

/** Pre-built default instance — reads OPENROUTER_API_KEY from env. */
export const openrouter = createOpenRouter();
