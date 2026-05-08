import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
} from "@ai-sdk/provider";
import type {
  ProviderV2,
} from "@ai-sdk/provider";

import {
  loadApiKey,
  withoutTrailingSlash,
} from "@ai-sdk/provider-utils";

import { createAnthropic } from "@ai-sdk/anthropic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClaudeModelId =
  | "claude-3-7-sonnet-20250219"
  | "claude-3-5-sonnet-latest"
  | "claude-3-5-sonnet-20241022"
  | "claude-3-5-sonnet-20240620"
  | "claude-3-5-haiku-latest"
  | "claude-3-5-haiku-20241022"
  | "claude-3-opus-latest"
  | "claude-3-opus-20240229"
  | "claude-3-sonnet-20240229"
  | "claude-3-haiku-20240307"
  | (string & {}); // allow arbitrary model strings

export interface ClaudeProviderSettings {
  /** Anthropic API key. Defaults to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Base URL for the Anthropic API. Defaults to https://api.anthropic.com */
  baseURL?: string;
  /** Extra headers to send on every request. */
  headers?: Record<string, string>;
}

export interface ClaudeModelSettings {
  /** Override the base URL per-model (e.g. for self-hosted). */
  baseURL?: string;
}

// ---------------------------------------------------------------------------
// ClaudeLanguageModel — wraps @ai-sdk/anthropic LanguageModelV2
// ---------------------------------------------------------------------------

export class ClaudeLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "anthropic";
  readonly modelId: ClaudeModelId;
  readonly defaultObjectGenerationMode = "json" as const;
  readonly supportsImageUrls = true;
  readonly supportedUrls: Record<string, RegExp[]> = {
    "image/*": [/data/, /https:\/\//],
  };

  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly anthropicModel: ReturnType<ReturnType<typeof createAnthropic>>;

  constructor(
    modelId: ClaudeModelId,
    providerSettings: ClaudeProviderSettings,
    modelSettings: ClaudeModelSettings = {}
  ) {
    this.modelId = modelId;
    this.baseURL = withoutTrailingSlash(
      modelSettings.baseURL ??
        providerSettings.baseURL ??
        "https://api.anthropic.com"
    ) ?? "https://api.anthropic.com";

    this.apiKey = loadApiKey({
      apiKey: providerSettings.apiKey,
      environmentVariableName: "ANTHROPIC_API_KEY",
      description: "Anthropic",
    }) ?? "";

    this.defaultHeaders = {
      ...providerSettings.headers,
    };

    // Create the Anthropic model from @ai-sdk/anthropic
    const anthropic = createAnthropic({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      headers: this.defaultHeaders,
    });

    this.anthropicModel = anthropic(modelId);
  }

  async doGenerate(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    return this.anthropicModel.doGenerate(options);
  }

  async doStream(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    return this.anthropicModel.doStream(options);
  }
}

// ---------------------------------------------------------------------------
// ClaudeProvider — implements ProviderV2
// ---------------------------------------------------------------------------

export interface ClaudeProvider extends ProviderV2 {
  (modelId: ClaudeModelId, settings?: ClaudeModelSettings): ClaudeLanguageModel;
}

export function createClaude(
  providerSettings: ClaudeProviderSettings = {}
): ClaudeProvider {
  const createModel = (
    modelId: ClaudeModelId,
    modelSettings: ClaudeModelSettings = {}
  ) => new ClaudeLanguageModel(modelId, providerSettings, modelSettings);

  const provider = function (
    modelId: ClaudeModelId,
    settings?: ClaudeModelSettings
  ) {
    return createModel(modelId, settings);
  } as ClaudeProvider;

  return provider;
}

/** Pre-built default instance — reads ANTHROPIC_API_KEY from env. */
export const claude = createClaude();
