---
description: Create a new tool for shty-harness following the established pattern
---

# Create New Tool Workflow

This workflow guides you through creating a new tool for shty-harness, following the same pattern we used for file operations and web search tools.

## Step 1: Define Tool Requirements

Before starting, clearly define:
- **Tool name**: Short, descriptive, snake_case (e.g., `git_ops`, `database_query`)
- **Purpose**: What the tool does and why it's needed
- **Operations**: Specific functions the tool will perform
- **Parameters**: Required and optional arguments
- **Dependencies**: External libraries or APIs needed

## Step 2: Create Tool Interface

Create the tool file at `src/tools/[tool-name].ts`:

```typescript
import type { ToolDefinition } from '../types.js';

export interface [ToolName]Args {
  // Define your tool parameters here
  parameter1: string;
  parameter2?: number;
  parameter3?: 'option1' | 'option2';
}

async function execute[ToolName](args: Record<string, unknown>): Promise<string> {
  const typedArgs = args as unknown as [ToolName]Args;
  const { parameter1, parameter2, parameter3 } = typedArgs;

  // Validate required parameters
  if (!parameter1 || typeof parameter1 !== 'string') {
    throw new Error('parameter1 is required and must be a string');
  }

  // Validate optional parameters
  if (parameter2 && (typeof parameter2 !== 'number' || parameter2 < 0)) {
    throw new Error('parameter2 must be a positive number');
  }

  try {
    // Implement your tool logic here
    const result = await yourToolFunction(parameter1, parameter2, parameter3);
    
    // Format the output
    return `Tool execution result: ${result}`;
  } catch (error) {
    const err = error as Error;
    throw new Error(`[ToolName] operation failed: ${err.message}`);
  }
}

export const [toolName]Tool: ToolDefinition = {
  name: '[tool_name]',
  description: 'Clear, concise description of what the tool does and when to use it.',
  parameters: {
    type: 'object',
    properties: {
      parameter1: {
        type: 'string',
        description: 'Description of parameter1',
      },
      parameter2: {
        type: 'number',
        minimum: 0,
        description: 'Description of parameter2 (optional)',
      },
      parameter3: {
        type: 'string',
        enum: ['option1', 'option2'],
        description: 'Description of parameter3 (optional)',
      },
    },
    required: ['parameter1'],
  },
  execute: execute[ToolName],
};
```

## Step 3: Add to Tools Index

Update `src/tools/index.ts`:

```typescript
// Add import
import { [toolName]Tool } from './[tool-name].js';

// Add to availableTools array
export const availableTools: ToolDefinition[] = [
  bashTool,
  fileOpsTool,
  webSearchTool,
  [toolName]Tool, // Add here
];

// Add exports
export { [toolName]Tool } from './[tool-name].js';
export type { [ToolName]Args } from './[tool-name].js';
```

## Step 4: Update CLI Integration

Update `src/cli.ts`:

```typescript
// Add import
import { bashTool, fileOpsTool, webSearchTool, [toolName]Tool } from './tools/index.js';

// Update tools system prompt
const TOOLS_SYSTEM_PROMPT = `You are a helpful assistant with access to system tools. Be concise and clear.

You have access to the following tools:
- bash: Execute bash commands on the local system...
- file_ops: Perform native file system operations...
- web_search: Search the web for information...
- [tool_name]: [Brief description of tool]

When you need to use a tool, the system will automatically execute it and return results to you.`;

// Add to enabled tools array
enabledTools = [bashTool, fileOpsTool, webSearchTool, [toolName]Tool];

// Update help text
console.log('  /tools, /t      - Toggle tools (bash, file_ops, web_search, [tool_name]) on/off');
```

## Step 5: Create Comprehensive Tests

Create `src/tools/__tests__/[tool-name].test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { [toolName]Tool } from '../[tool-name].js';

// Mock any external dependencies
const mockExternalFunction = vi.fn();
// global.someLibrary = mockExternalFunction;

describe('[toolName]Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate required parameters', async () => {
    await expect(
      [toolName]Tool.execute({})
    ).rejects.toThrow('parameter1 is required and must be a string');
  });

  it('should validate optional parameters', async () => {
    await expect(
      [toolName]Tool.execute({ parameter1: 'test', parameter2: -1 })
    ).rejects.toThrow('parameter2 must be a positive number');
  });

  it('should execute successfully with valid parameters', async () => {
    // Mock successful execution
    mockExternalFunction.mockResolvedValue('success');

    const result = await [toolName]Tool.execute({
      parameter1: 'test',
      parameter2: 10,
      parameter3: 'option1',
    });

    expect(result).toContain('Tool execution result: success');
    expect(mockExternalFunction).toHaveBeenCalledWith('test', 10, 'option1');
  });

  it('should handle execution errors', async () => {
    // Mock execution error
    mockExternalFunction.mockRejectedValue(new Error('Execution failed'));

    await expect(
      [toolName]Tool.execute({ parameter1: 'test' })
    ).rejects.toThrow('[ToolName] operation failed: Execution failed');
  });

  it('should handle edge cases', async () => {
    // Test edge cases specific to your tool
  });
});
```

## Step 6: Build and Test

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Run tests**:
   ```bash
   npm test -- src/tools/__tests__/[tool-name].test.ts
   ```

3. **Fix any TypeScript or test errors**

## Step 7: Integration Testing

Test the tool in the CLI:

1. Start the CLI: `node dist/cli.js`
2. Enable tools: `/tools`
3. Test the tool: `"Use [tool_name] to [do something]"`
4. Verify results and error handling

## Best Practices

### Tool Design
- **Single responsibility**: Each tool should do one thing well
- **Clear naming**: Use descriptive, snake_case names
- **Comprehensive validation**: Validate all parameters before execution
- **Graceful error handling**: Provide clear error messages

### Parameter Design
- **Required vs optional**: Clearly distinguish required parameters
- **Type safety**: Use proper TypeScript types
- **Validation**: Add appropriate constraints (min, max, enum)
- **Documentation**: Provide clear descriptions for each parameter

### Error Handling
- **Parameter validation**: Catch invalid inputs early
- **Execution errors**: Wrap in try-catch with meaningful messages
- **Consistent format**: Use consistent error message patterns
- **User-friendly**: Make errors actionable for users

### Testing
- **Comprehensive coverage**: Test all parameters and edge cases
- **Mock dependencies**: Mock external APIs and libraries
- **Error scenarios**: Test both success and failure cases
- **Integration testing**: Test in the actual CLI environment

## Tool Examples

### Simple Tool (API Client)
```typescript
export interface ApiCallArgs {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}
```

### Complex Tool (Database Operations)
```typescript
export interface DatabaseOpsArgs {
  operation: 'query' | 'insert' | 'update' | 'delete';
  table: string;
  where?: Record<string, any>;
  data?: Record<string, any>;
  limit?: number;
}
```

### File-based Tool (Configuration Management)
```typescript
export interface ConfigOpsArgs {
  operation: 'read' | 'write' | 'validate' | 'merge';
  config_path: string;
  config_data?: Record<string, any>;
  format?: 'json' | 'yaml' | 'toml';
}
```

## Integration Checklist

- [ ] Tool file created with proper TypeScript types
- [ ] Tool added to tools index
- [ ] CLI updated with tool import and integration
- [ ] System prompt updated with tool description
- [ ] Help text updated
- [ ] Comprehensive test suite created
- [ ] All tests passing
- [ ] Build successful
- [ ] Manual testing in CLI completed
- [ ] Documentation updated (if needed)

## Common Pitfalls to Avoid

1. **Missing parameter validation** - Always validate inputs
2. **Poor error messages** - Make errors actionable
3. **Incomplete testing** - Test edge cases and errors
4. **Forgotten CLI integration** - Update all CLI references
5. **TypeScript errors** - Fix all type issues before testing
6. **Async/await issues** - Handle promises correctly
7. **External dependencies** - Mock external calls in tests

## Next Steps

After creating your tool:
1. Test thoroughly in different scenarios
2. Consider adding additional features or parameters
3. Update documentation if the tool is complex
4. Share with others for feedback
5. Consider creating additional related tools

This workflow ensures consistency with existing tools and provides a solid foundation for extending shty-harness capabilities.
