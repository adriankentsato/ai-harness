import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  ProviderV2,
} from "@ai-sdk/provider";

import {
  loadApiKey,
  withoutTrailingSlash,
} from "@ai-sdk/provider-utils";

import { createOpenAI } from "@ai-sdk/openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpenAIModelId =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4.1"
  | "gpt-4.1-mini"
  | "gpt-4.1-nano"
  | "o1"
  | "o1-mini"
  | "o1-preview"
  | "o3"
  | "o3-mini"
  | "o4-mini"
  | "gpt-5"
  | "gpt-5-mini"
  | "gpt-5-nano"
  | (string & {}); // allow arbitrary model strings

export interface OpenAIProviderSettings {
  /** OpenAI API key. Defaults to OPENAI_API_KEY env var. */
  apiKey?: string;
  /** Base URL for the OpenAI API. Defaults to https://api.openai.com/v1 */
  baseURL?: string;
  /** Extra headers to send on every request. */
  headers?: Record<string, string>;
}

export interface OpenAIModelSettings {
  /** Override the base URL per-model (e.g. for self-hosted). */
  baseURL?: string;
}

// ---------------------------------------------------------------------------
// OpenAILanguageModel — wraps @ai-sdk/openai LanguageModelV2
// ---------------------------------------------------------------------------

export class OpenAILanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "openai";
  readonly modelId: OpenAIModelId;
  readonly defaultObjectGenerationMode = "json" as const;
  readonly supportsImageUrls = true;
  readonly supportedUrls: Record<string, RegExp[]> = {
    "image/*": [/data/, /https:\/\//],
  };

  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly openAIModel: ReturnType<ReturnType<typeof createOpenAI>>;

  constructor(
    modelId: OpenAIModelId,
    providerSettings: OpenAIProviderSettings,
    _modelSettings: OpenAIModelSettings = {}
  ) {
    this.modelId = modelId;
    this.baseURL = withoutTrailingSlash(
      _modelSettings.baseURL ??
        providerSettings.baseURL ??
        "https://api.openai.com/v1"
    ) ?? "https://api.openai.com/v1";

    this.apiKey = loadApiKey({
      apiKey: providerSettings.apiKey,
      environmentVariableName: "OPENAI_API_KEY",
      description: "OpenAI",
    }) ?? "";

    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...providerSettings.headers,
    };

    // Create the OpenAI model from @ai-sdk/openai
    const openai = createOpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      headers: this.defaultHeaders,
    });

    this.openAIModel = openai(modelId);
  }

  // -------------------------------------------------------------------------
  // doGenerate — non-streaming
  // -------------------------------------------------------------------------

  async doGenerate(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    return this.openAIModel.doGenerate(options);
  }

  // -------------------------------------------------------------------------
  // doStream — streaming
  // -------------------------------------------------------------------------

  async doStream(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    return this.openAIModel.doStream(options);
  }
}

// ---------------------------------------------------------------------------
// OpenAIProvider — implements ProviderV2
// ---------------------------------------------------------------------------

export interface OpenAIProvider extends ProviderV2 {
  (modelId: OpenAIModelId, settings?: OpenAIModelSettings): OpenAILanguageModel;
}

export function createOpenAIModel(
  providerSettings: OpenAIProviderSettings = {}
): OpenAIProvider {
  const createModel = (
    modelId: OpenAIModelId,
    modelSettings: OpenAIModelSettings = {}
  ) => new OpenAILanguageModel(modelId, providerSettings, modelSettings);

  const provider = function (
    modelId: OpenAIModelId,
    settings?: OpenAIModelSettings
  ) {
    return createModel(modelId, settings);
  } as OpenAIProvider;

  return provider;
}

/** Pre-built default instance — reads OPENAI_API_KEY from env. */
export const openaiModels = createOpenAIModel();