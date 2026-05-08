import { describe, it, expect, vi, beforeEach } from "vitest";
import { OllamaProvider } from "../ollama";

describe("OllamaProvider v2", () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OllamaProvider();
  });

  describe("constructor", () => {
    it("should initialize with correct defaults", () => {
      expect(provider.name).toBe("ollama");
      expect(provider.defaultModel).toBe("llama3.1");
    });

    it("should accept custom configuration", () => {
      const customProvider = new OllamaProvider({
        baseUrl: "http://custom:11434",
        timeout: 30000,
      });
      expect(customProvider.name).toBe("ollama");
    });
  });

  describe("validateConfig", () => {
    it("should always return true (no auth needed)", () => {
      expect(provider.validateConfig()).toBe(true);
    });
  });

  describe("fetchModels", () => {
    it("should return models when API is successful", async () => {
      const mockModels = {
        models: [
          {
            name: "llama3.1",
            model: "llama3.1",
            parameter_size: "8B",
            quantization_level: "Q4_0",
          },
          {
            name: "mistral:7b",
            model: "mistral:7b",
            parameter_size: "7B",
            quantization_level: "Q4_K_M",
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockModels),
      });

      const models = await provider.fetchModels();

      expect(models.length).toBe(2);
      expect(models[0].id).toBe("llama3.1");
      expect(models[0].description).toBe("8B Q4_0");
      expect(models[1].id).toBe("mistral:7b");
    });

    it("should return fallback on API failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const models = await provider.fetchModels();

      expect(models).toEqual([]);
    });
  });

  describe("complete", () => {
    it("should use default model when none specified", () => {
      expect(provider.defaultModel).toBe("llama3.1");
    });

    it("should be a function", () => {
      expect(typeof provider.complete).toBe("function");
    });
  });

  describe("stream", () => {
    it("should be an async generator function", () => {
      expect(typeof provider.stream).toBe("function");
    });

    it("should return an async iterable", () => {
      const stream = provider.stream([
        { role: "user", content: "Hello" },
      ], { model: "llama3.1" });

      expect(typeof stream[Symbol.asyncIterator]).toBe("function");
    });
  });
});
