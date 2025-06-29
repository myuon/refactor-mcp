import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'refactor-mcp',
  version: '1.0.0',
});

server.registerTool(
  'extract-method',
  {
    title: 'Extract Method',
    description: 'Extract selected code into a new method',
    inputSchema: {
      code: z.string().describe('Code to extract'),
      methodName: z.string().describe('Name for the new method'),
      returnType: z.string().optional().describe('Return type of the method'),
      parameters: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
          })
        )
        .optional()
        .describe('Method parameters'),
    },
  },
  async ({ code, methodName, returnType, parameters }) => {
    const paramList =
      parameters?.map(p => `${p.name}: ${p.type}`).join(', ') || '';
    const returnTypeStr = returnType ? `: ${returnType}` : '';

    const extractedMethod = `function ${methodName}(${paramList})${returnTypeStr} {
  ${code}
}`;

    const callExpression = parameters
      ? `${methodName}(${parameters.map(p => p.name).join(', ')})`
      : `${methodName}()`;

    return {
      content: [
        {
          type: 'text',
          text: `Extracted method:\n\n${extractedMethod}\n\nCall site:\n${callExpression}`,
        },
      ],
    };
  }
);

server.registerTool(
  'rename-variable',
  {
    title: 'Rename Variable',
    description: 'Rename a variable throughout the code',
    inputSchema: {
      code: z.string().describe('Code containing the variable'),
      oldName: z.string().describe('Current variable name'),
      newName: z.string().describe('New variable name'),
    },
  },
  async ({ code, oldName, newName }) => {
    const regex = new RegExp(`\\b${oldName}\\b`, 'g');
    const refactoredCode = code.replace(regex, newName);

    return {
      content: [
        {
          type: 'text',
          text: `Refactored code:\n\n${refactoredCode}`,
        },
      ],
    };
  }
);

server.registerTool(
  'extract-interface',
  {
    title: 'Extract Interface',
    description: 'Extract an interface from a class or object',
    inputSchema: {
      code: z.string().describe('Code to extract interface from'),
      interfaceName: z.string().describe('Name for the interface'),
      methods: z
        .array(
          z.object({
            name: z.string(),
            returnType: z.string(),
            parameters: z
              .array(
                z.object({
                  name: z.string(),
                  type: z.string(),
                })
              )
              .optional(),
          })
        )
        .describe('Methods to include in interface'),
    },
  },
  async ({ interfaceName, methods }) => {
    const methodSignatures = methods
      .map(method => {
        const params =
          method.parameters?.map(p => `${p.name}: ${p.type}`).join(', ') || '';
        return `  ${method.name}(${params}): ${method.returnType};`;
      })
      .join('\n');

    const interfaceCode = `interface ${interfaceName} {
${methodSignatures}
}`;

    return {
      content: [
        {
          type: 'text',
          text: `Extracted interface:\n\n${interfaceCode}`,
        },
      ],
    };
  }
);

server.registerTool(
  'inline-method',
  {
    title: 'Inline Method',
    description: 'Inline a method call with its implementation',
    inputSchema: {
      methodImplementation: z
        .string()
        .describe('Method implementation to inline'),
      callSite: z.string().describe('Method call to replace'),
      argumentMappings: z
        .record(z.string())
        .optional()
        .describe('Mapping of parameter names to argument values'),
    },
  },
  async ({ methodImplementation, callSite, argumentMappings }) => {
    let inlinedCode = methodImplementation;

    if (argumentMappings) {
      Object.entries(argumentMappings).forEach(([param, arg]) => {
        const regex = new RegExp(`\\b${param}\\b`, 'g');
        inlinedCode = inlinedCode.replace(regex, arg);
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: `Original call: ${callSite}\n\nInlined code:\n${inlinedCode}`,
        },
      ],
    };
  }
);

server.registerPrompt(
  'refactor-analysis',
  {
    title: 'Refactor Analysis',
    description: 'Analyze code and suggest refactoring opportunities',
    argsSchema: {
      code: z.string().describe('Code to analyze for refactoring'),
    },
  },
  ({ code }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please analyze the following code and suggest refactoring opportunities:

${code}

Consider the following refactoring patterns:
- Extract Method
- Extract Interface/Class
- Rename Variable/Method
- Inline Method
- Move Method
- Remove Duplicated Code
- Replace Conditional with Polymorphism

Provide specific suggestions with explanations.`,
        },
      },
    ],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
