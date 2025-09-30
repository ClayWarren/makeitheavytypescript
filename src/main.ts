import { OpenRouterAgent } from './agent';
import { loadConfig } from './config';

export async function main() {
  console.log('OpenRouter Agent with DuckDuckGo Search');
  console.log("Type 'quit', 'exit', or 'bye' to exit");
  console.log('-'.repeat(50));

  let agent: OpenRouterAgent;

  try {
    const config = loadConfig();
    agent = new OpenRouterAgent(config);
    console.log('Agent initialized successfully!');
    console.log(`Using model: ${config.openrouter.model}`);
    console.log(
      'Note: Make sure to set your OpenRouter API key in config.yaml'
    );
    console.log('-'.repeat(50));
  } catch (error) {
    console.log(`Error initializing agent: ${error}`);
    console.log('Make sure you have:');
    console.log('1. Set your OpenRouter API key in config.yaml');
    console.log('2. Installed all dependencies with: npm install');
    return;
  }

  // Simple CLI loop
  const readline = (await import('readline')).default;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function askQuestion() {
    rl.question('\nUser: ', async (userInput: string) => {
      if (
        userInput.toLowerCase() === 'quit' ||
        userInput.toLowerCase() === 'exit' ||
        userInput.toLowerCase() === 'bye'
      ) {
        console.log('Goodbye!');
        rl.close();
        return;
      }

      if (!userInput.trim()) {
        console.log('Please enter a question or command.');
        askQuestion();
        return;
      }

      console.log('Agent: Thinking...');
      try {
        const response = await agent.run(userInput);
        console.log(`Agent: ${response}`);
      } catch (error) {
        console.log(`Error: ${error}`);
        console.log("Please try again or type 'quit' to exit.");
      }

      askQuestion();
    });
  }

  askQuestion();
}

main().catch(console.error);
