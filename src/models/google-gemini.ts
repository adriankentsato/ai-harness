import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  ProviderV2,
} from "@ai-sdk/provider";

import {
  loadApiKey,
  withoutTrailingSlash,
} from "@ai-sdk/provider-utils";

import { createGoogleGenerativeAI } from "@ai-sdk/google";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GoogleModelId =
  | "gemini-2.0-flash"
  | "gemini-2.0-flash-thinking"
  | "gemini-2.0-pro"
  | "gemini-1.5-pro"
  | "gemini-1.5-flash"
  | "gemini-1.5-flash-8b"
  | "gemini-1.0-pro"
  | (string & {}); // allow arbitrary model strings

export interface GoogleProviderSettings {
  /** Google AI API key. Defaults to GOOGLE_API_KEY env var. */
  apiKey?: string;
  /** Base URL for the Google AI API. Defaults to https://generativelanguage.googleapis.com/v1beta */
  baseURL?: string;
  /** Extra headers to send on every request. */
  headers?: Record<string, string>;
}

export interface GoogleModelSettings {
  /** Override the base URL per-model (e.g. for self-hosted). */
  baseURL?: string;
}

// ---------------------------------------------------------------------------
// GoogleLanguageModel — wraps @ai-sdk/google LanguageModelV2
// ---------------------------------------------------------------------------

export class GoogleLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "google-gemini";
  readonly modelId: GoogleModelId;
  readonly defaultObjectGenerationMode = "json" as const;
  readonly supportsImageUrls = true;
  readonly supportedUrls: Record<string, RegExp[]> = {
    "image/*": [/data/, /https:\/\//],
  };

  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly googleModel: ReturnType<ReturnType<typeof createGoogleGenerativeAI>>;

  constructor(
    modelId: GoogleModelId,
    providerSettings: GoogleProviderSettings,
    _modelSettings: GoogleModelSettings = {}
  ) {
    this.modelId = modelId;
    this.baseURL = withoutTrailingSlash(
      _modelSettings.baseURL ??
        providerSettings.baseURL ??
        "https://generativelanguage.googleapis.com/v1beta"
    ) ?? "https://generativelanguage.googleapis.com/v1beta";

    this.apiKey = loadApiKey({
      apiKey: providerSettings.apiKey,
      environmentVariableName: "GOOGLE_API_KEY",
      description: "Google AI",
    }) ?? "";

    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...providerSettings.headers,
    };

    // Create the Google model from @ai-sdk/google
    const google = createGoogleGenerativeAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      headers: this.defaultHeaders,
    });

    this.googleModel = google(modelId);
  }

  // -------------------------------------------------------------------------
  // doGenerate — non-streaming
  // -------------------------------------------------------------------------

  async doGenerate(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    return this.googleModel.doGenerate(options);
  }

  // -------------------------------------------------------------------------
  // doStream — streaming
  // -------------------------------------------------------------------------

  async doStream(
    options: LanguageModelV2CallOptions
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    return this.googleModel.doStream(options);
  }
}

// ---------------------------------------------------------------------------
// GoogleProvider — implements ProviderV2
// ---------------------------------------------------------------------------

export interface GoogleProvider extends ProviderV2 {
  (modelId: GoogleModelId, settings?: GoogleModelSettings): GoogleLanguageModel;
}

export function createGoogle(
  providerSettings: GoogleProviderSettings = {}
): GoogleProvider {
  const createModel = (
    modelId: GoogleModelId,
    modelSettings: GoogleModelSettings = {}
  ) => new GoogleLanguageModel(modelId, providerSettings, modelSettings);

  const provider = function (
    modelId: GoogleModelId,
    settings?: GoogleModelSettings
  ) {
    return createModel(modelId, settings);
  } as GoogleProvider;

  return provider;
}

/** Pre-built default instance — reads GOOGLE_API_KEY from env. */
export const google = createGoogle();
