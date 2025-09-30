import { TaskOrchestrator } from './orchestrator';
import { loadConfig } from './config';

class OrchestratorCLI {
  private orchestrator: TaskOrchestrator;
  private startTime: number | null = null;
  private running: boolean = false;

  constructor() {
    const config = loadConfig();
    this.orchestrator = new TaskOrchestrator(config);

    // Extract model name for display
    const modelFull = config.openrouter.model;
    let modelName = modelFull;
    if (modelFull.includes('/')) {
      modelName = modelFull.split('/').pop() || modelFull;
    }

    // Clean up model name for display
    const modelParts = modelName.split('-');
    const cleanName = modelParts.slice(0, 3).join('-');
    this.modelDisplay = cleanName.toUpperCase() + ' HEAVY';
  }

  private modelDisplay: string;

  clearScreen(): void {
    console.clear();
  }

  formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.floor(seconds)}S`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}M${secs}S`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}H${minutes}M`;
    }
  }

  createProgressBar(status: string): string {
    const ORANGE = '\x1b[38;5;208m';
    const RED = '\x1b[91m';
    const RESET = '\x1b[0m';

    if (status === 'QUEUED') {
      return '○ ' + '·'.repeat(70);
    } else if (status === 'INITIALIZING...') {
      return `${ORANGE}◐${RESET} ` + '·'.repeat(70);
    } else if (status === 'PROCESSING...') {
      const dots = `${ORANGE}:${RESET}`.repeat(10) + '·'.repeat(60);
      return `${ORANGE}●${RESET} ` + dots;
    } else if (status === 'COMPLETED') {
      return `${ORANGE}●${RESET} ` + `${ORANGE}:${RESET}`.repeat(70);
    } else if (status.startsWith('FAILED')) {
      return `${RED}✗${RESET} ` + `${RED}×${RESET}`.repeat(70);
    } else {
      return `${ORANGE}◐${RESET} ` + '·'.repeat(70);
    }
  }

  updateDisplay(): void {
    if (!this.running) {
      return;
    }

    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const timeStr = this.formatTime(elapsed);

    const progress = this.orchestrator.getProgressStatus();

    this.clearScreen();

    console.log(this.modelDisplay);
    if (this.running) {
      console.log(`● RUNNING • ${timeStr}`);
    } else {
      console.log(`● COMPLETED • ${timeStr}`);
    }
    console.log();

    for (let i = 0; i < this.orchestrator['numAgents']; i++) {
      const status = progress.get(i) || 'QUEUED';
      const progressBar = this.createProgressBar(status);
      console.log(`AGENT ${String(i + 1).padStart(2, '0')}  ${progressBar}`);
    }

    console.log();
    process.stdout.write('\x1b[?25l'); // Hide cursor
  }

  progressMonitor(): void {
    const interval = setInterval(() => {
      this.updateDisplay();
    }, 1000);

    // Restore cursor when done
    process.on('exit', () => {
      clearInterval(interval);
      process.stdout.write('\x1b[?25h');
    });
  }

  async runTask(userInput: string): Promise<string | null> {
    this.startTime = Date.now();
    this.running = true;

    // Start progress monitoring
    this.progressMonitor();

    try {
      const result = await this.orchestrator.orchestrate(userInput);

      this.running = false;
      this.updateDisplay();

      console.log('='.repeat(80));
      console.log('FINAL RESULTS');
      console.log('='.repeat(80));
      console.log();
      console.log(result);
      console.log();
      console.log('='.repeat(80));

      return result;
    } catch (error) {
      this.running = false;
      this.updateDisplay();
      console.log(`\nError during orchestration: ${error}`);
      return null;
    }
  }

  async interactiveMode(): Promise<void> {
    console.log('Multi-Agent Orchestrator');
    console.log(
      `Configured for ${this.orchestrator['numAgents']} parallel agents`
    );
    console.log("Type 'quit', 'exit', or 'bye' to exit");
    console.log('-'.repeat(50));

    try {
      const config = loadConfig();
      console.log(`Using model: ${config.openrouter.model}`);
      console.log('Orchestrator initialized successfully!');
      console.log(
        'Note: Make sure to set your OpenRouter API key in config.yaml'
      );
      console.log('-'.repeat(50));
    } catch (error) {
      console.log(`Error initializing orchestrator: ${error}`);
      console.log('Make sure you have:');
      console.log('1. Set your OpenRouter API key in config.yaml');
      console.log('2. Installed all dependencies with: npm install');
      return;
    }

    const readline = (await import('readline')).default;
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    function askQuestion(this: OrchestratorCLI) {
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
          askQuestion.call(this);
          return;
        }

        console.log('\nOrchestrator: Starting multi-agent analysis...');
        console.log();

        const result = await this.runTask(userInput);

        if (result === null) {
          console.log('Task failed. Please try again.');
        }

        askQuestion.call(this);
      });
    }

    askQuestion();
  }
}

async function main() {
  const cli = new OrchestratorCLI();
  await cli.interactiveMode();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
