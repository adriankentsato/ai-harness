import { AIHarness } from '../src/index';

async function workflowExample() {
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

  harness.registerAgent({
    name: 'writer',
    description: 'Content writing and editing specialist',
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1500,
  });

  try {
    console.log('=== Parallel Execution Example ===');
    
    // Define tasks for parallel execution
    const parallelTasks = [
      {
        agentName: 'code-assistant',
        input: 'Write a Python function that calculates fibonacci numbers recursively and explain its time complexity.',
      },
      {
        agentName: 'data-analyst',
        input: 'Explain how to perform exploratory data analysis on a customer dataset and what key metrics to track.',
      },
      {
        agentName: 'writer',
        input: 'Write a short blog post introduction about the importance of code documentation.',
      },
    ];

    // Execute tasks in parallel
    const parallelResults = await harness.executeAgentsParallel(parallelTasks, {
      maxConcurrency: 3,
      timeout: 30000,
      continueOnError: true,
    });

    console.log('Parallel Results:');
    console.log(`Total tasks: ${parallelResults.totalTasks}`);
    console.log(`Completed: ${parallelResults.completedTasks}`);
    console.log(`Failed: ${parallelResults.failedTasks}`);
    console.log(`Total time: ${parallelResults.totalExecutionTime}ms`);
    console.log(`Success: ${parallelResults.success}`);

    parallelResults.results.forEach((result, index) => {
      console.log(`\nTask ${index + 1} (${result.agentName}):`);
      if (result.error) {
        console.log(`Error: ${result.error}`);
      } else {
        console.log(`Response: ${result.result.response.substring(0, 200)}...`);
        console.log(`Execution time: ${result.executionTime}ms`);
        console.log(`Tokens used: ${result.result.usage.totalTokens}`);
      }
    });

    console.log('\n=== Sequential Execution Example ===');

    // Execute tasks sequentially
    const sequentialResults = await harness.executeAgentsSequential(parallelTasks, {
      timeout: 30000,
      continueOnError: true,
    });

    console.log('Sequential Results:');
    console.log(`Total tasks: ${sequentialResults.totalTasks}`);
    console.log(`Completed: ${sequentialResults.completedTasks}`);
    console.log(`Failed: ${sequentialResults.failedTasks}`);
    console.log(`Total time: ${sequentialResults.totalExecutionTime}ms`);
    console.log(`Success: ${sequentialResults.success}`);

    console.log('\n=== Performance Comparison ===');
    console.log(`Parallel execution time: ${parallelResults.totalExecutionTime}ms`);
    console.log(`Sequential execution time: ${sequentialResults.totalExecutionTime}ms`);
    console.log(`Speed improvement: ${(sequentialResults.totalExecutionTime / parallelResults.totalExecutionTime).toFixed(2)}x`);

    console.log('\n=== Workflow Method Example ===');
    
    // Using the unified workflow method
    const workflowResults = await harness.executeAgentWorkflow(
      [
        {
          agentName: 'code-assistant',
          input: 'Create a TypeScript interface for a user profile with validation.',
        },
        {
          agentName: 'data-analyst',
          input: 'Describe the steps to clean and preprocess raw sales data.',
        },
      ],
      'parallel',
      { maxConcurrency: 2, timeout: 20000 }
    );

    console.log('Workflow Results:');
    workflowResults.results.forEach((result, index) => {
      console.log(`Task ${index + 1}: ${result.result.response.substring(0, 100)}...`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  workflowExample();
}

export { workflowExample };
