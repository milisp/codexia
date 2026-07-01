import ClaudeCodeIcon from '@/assets/claudecode-color.svg';
import CodexIcon from '@/assets/codex-color.svg';
import GeminiIcon from '@/assets/gemini-color.svg';
import GithubIcon from '@/assets/github.svg';
import MCPIcon from '@/assets/mcp.svg'
import AtlasCloudIcon from '@/assets/atlascloud.svg';
import OpenAIIcon from '@/assets/openai.svg';
import OpenRouterIcon from '@/assets/openrouter.svg';
import OllamaIcon from '@/assets/ollama.svg';
import NvidiaIcon from '@/assets/nvidia-color.svg';

type IconSize = 'sm' | 'md' | 'lg';

interface BaseIconProps {
  size?: IconSize;
  className?: string;
}

interface ProviderIconsProps extends BaseIconProps {
  providerId: string;
}

const getSizeClass = (size: IconSize) => {
  switch (size) {
    case 'sm': return 'h-4 w-4';
    case 'md': return 'h-6 w-6';
    case 'lg': return 'h-8 w-8';
  }
};

export function ProviderIcons({ providerId, size = 'md', className = '' }: ProviderIconsProps) {
  return (
    <div className={`${getSizeClass(size)} flex items-center justify-center ${className}`.trim()}>
      {providerId === 'atlascloud' && <img src={AtlasCloudIcon} alt="AtlasCloud" className="h-full w-full object-contain" />}
      {providerId === 'openai' && <img src={OpenAIIcon} alt="OpenAI" className="h-full w-full object-contain" />}
      {providerId === 'openrouter' && <img src={OpenRouterIcon} alt="OpenRouter" className="h-full w-full object-contain" />}
      {providerId === 'ollama' && <img src={OllamaIcon} alt="Ollama" className="h-full w-full object-contain" />}
      {providerId === 'nvidia' && <img src={NvidiaIcon} alt="NVIDIA" className="h-full w-full object-contain" />}
    </div>
  );
}

export function ClaudeCode({ size = 'md', className = '' }: BaseIconProps) {
  return <img src={ClaudeCodeIcon} alt="claude-code" className={`${getSizeClass(size)} ${className}`.trim()} />
}

export function Codex({ size = 'md', className = '' }: BaseIconProps) {
  return <img src={CodexIcon} alt="codex" className={`${getSizeClass(size)} ${className}`.trim()} />
}

export function Gemini({ size = 'md', className = '' }: BaseIconProps) {
  return <img src={GeminiIcon} alt="gemini" className={`${getSizeClass(size)} ${className}`.trim()} />
}

export function Github({ size = 'md', className = '' }: BaseIconProps) {
  return <img src={GithubIcon} alt="github" className={`${getSizeClass(size)} ${className}`.trim()} />
}

export function MCP({ size = 'md', className = '' }: BaseIconProps) {
  return <img src={MCPIcon} alt="mcp" className={`${getSizeClass(size)} ${className}`.trim()} />
}