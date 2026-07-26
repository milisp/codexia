import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function McpLinkerButton() {
  return (
    <Button
      onClick={() => {
        const url = 'https://github.com/milisp/mcp-linker';
        window.open(url, '_blank', 'noopener,noreferrer');
      }}
    >
      <Download /> MCP Linker for more
    </Button>
  );
}
