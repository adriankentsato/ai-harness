// V2 Providers (Default - AI SDK V5+)
export { OpenAIProvider } from './v2/openai';
export { ClaudeProvider } from './v2/claude';
export { NvidiaProvider } from './v2/nvidia';
export { OpenRouterProvider } from './v2/openrouter';
export { OllamaProvider } from './v2/ollama';
export { GoogleProvider } from './v2/google';

// V1 Providers (Deprecated - AI SDK V4)
// @deprecated Use V2 providers instead. V1 will be removed in next major version.
export { OpenAIProvider as OpenAIProviderV1 } from './v1/openai';
// @deprecated Use V2 providers instead. V1 will be removed in next major version.
export { ClaudeProvider as ClaudeProviderV1 } from './v1/claude';
// @deprecated Use V2 providers instead. V1 will be removed in next major version.
export { NvidiaProvider as NvidiaProviderV1 } from './v1/nvidia';
// @deprecated Use V2 providers instead. V1 will be removed in next major version.
export { OpenRouterProvider as OpenRouterProviderV1 } from './v1/openrouter';
// @deprecated Use V2 providers instead. V1 will be removed in next major version.
export { OllamaProvider as OllamaProviderV1 } from './v1/ollama';
