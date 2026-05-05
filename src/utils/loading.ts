import { randomInt } from 'crypto';

// Loading spinner frames
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Inspirational/cool texts
const INSPIRATIONAL_TEXTS = [
  'Processing brilliance...',
  'Cooking up something amazing...',
  'Warming up the neural nets...',
  'Consulting the digital oracle...',
  'Harnessing the power of AI...',
  'Distilling pure genius...',
  'Weaving digital magic...',
  'Activating superintelligence...',
  'Channeling algorithmic wisdom...',
  'Compiling cosmic knowledge...',
  'Transmuting data into gold...',
  'Summoning the AI spirits...',
  'Aligning the binary stars...',
  'Calibrating the mind matrix...',
  'Tuning the frequency of innovation...',
  'Orchestrating symphonic code...',
  'Polishing the crystal ball...',
  'Reading the digital tea leaves...',
  'Conversing with the machine gods...',
  'Extracting essence from entropy...',
];

export class LoadingDisplay {
  private spinnerIndex = 0;
  private textIndex = 0;
  private interval: NodeJS.Timeout | null = null;
  private lastTextLength = 0;

  constructor() {
    // Randomize starting positions
    this.spinnerIndex = randomInt(0, SPINNER_FRAMES.length);
    this.textIndex = randomInt(0, INSPIRATIONAL_TEXTS.length);
  }

  start(): void {
    if (this.interval) return;

    this.interval = setInterval(() => {
      const spinner = SPINNER_FRAMES[this.spinnerIndex];
      const text = INSPIRATIONAL_TEXTS[this.textIndex];
      const display = `${spinner} ${text}`;
      
      // Clear previous line and write new content
      process.stdout.write('\r' + ' '.repeat(this.lastTextLength) + '\r');
      process.stdout.write(display);
      
      this.lastTextLength = display.length;
      
      // Advance frames
      this.spinnerIndex = (this.spinnerIndex + 1) % SPINNER_FRAMES.length;
      this.textIndex = (this.textIndex + 1) % INSPIRATIONAL_TEXTS.length;
    }, 200);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Clear the loading display
    process.stdout.write('\r' + ' '.repeat(this.lastTextLength) + '\r');
  }
}
