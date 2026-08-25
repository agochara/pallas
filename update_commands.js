const fs = require('fs');
let code = fs.readFileSync('src/coach/commands.ts', 'utf8');

// Change return type
code = code.replace(
  'export async function executeCoachCommand(input: string): Promise<string>',
  `export type CommandResult = {
  text: string;
  ui?: 'bmi' | 'search';
  payload?: any;
};

export async function executeCoachCommand(input: string): Promise<CommandResult>`
);

// Helper to wrap strings
function wrapReturn(oldText, newText) {
  code = code.split(oldText).join(newText);
}

// Just wrapping everything in { text: ... } is tedious. Let's do a regex replace for 'return "...";' or 'return [...\n].join(...);'
// Or we can just rewrite the whole file, it's short.
