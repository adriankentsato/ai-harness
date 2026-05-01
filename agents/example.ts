import { AIHarness } from '../src/index';
import { createCodeAssistantAgent, createDataAnalystAgent } from '../src/agents/index';

async function exampleUsage() {
  // Initialize the harness
  const harness = new AIHarness();

  // Register providers (you'll need to set up API keys)
  harness.registerProvider('openai', {
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
  });

  // Register agents
  harness.registerAgent({
    name: 'code-assistant',
    description: 'Specialized code assistant for programming tasks',
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 2000,
  });

  harness.registerAgent({
    name: 'data-analyst',
    description: 'Data analysis and visualization specialist',
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.2,
    maxTokens: 3000,
  });

  try {
    // Use the code assistant agent
    console.log('=== Code Assistant Example ===');
    const codeResult = await harness.executeAgent(
      'code-assistant',
      'Write a TypeScript function that validates email addresses using regex and explain the pattern.'
    );
    console.log('Response:', codeResult.response);
    console.log('Usage:', codeResult.usage);

    // Use the data analyst agent
    console.log('\n=== Data Analyst Example ===');
    const dataResult = await harness.executeAgent(
      'data-analyst',
      'Explain how I would analyze customer churn data and what key metrics I should track.'
    );
    console.log('Response:', dataResult.response);
    console.log('Usage:', dataResult.usage);

    // List all registered agents
    console.log('\n=== Registered Agents ===');
    console.log(harness.listAgents());

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage();
}

export { exampleUsage };
