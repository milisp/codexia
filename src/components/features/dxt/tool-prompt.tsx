import type { z } from 'zod';
import type { DxtManifestSchema } from './schemas';

// ToolPrompt component displays tools and prompts from the manifest
export function ToolPrompt({ manifest }: { manifest: z.infer<typeof DxtManifestSchema> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      {/* Tools */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Tools</h2>
        {manifest.tools && manifest.tools.length > 0 ? (
          <ul className="list-disc pl-5">
            {manifest.tools.map((tool, idx) => (
              <li key={idx} className="mb-1">
                <span className="font-medium">{tool.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-gray-500">No tools</div>
        )}
      </div>
      {/* Prompts */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Prompts</h2>
        {manifest.prompts && manifest.prompts.length > 0 ? (
          <ul className="list-disc pl-5">
            {manifest.prompts.map((prompt, idx) => (
              <li key={idx} className="mb-2">
                <div className="font-medium">{prompt.name}</div>
                {prompt.description && (
                  <div className="text-gray-600 text-sm">{prompt.description}</div>
                )}
                <div className="text-gray-800 text-sm mt-1 whitespace-pre-line">{prompt.text}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-gray-500">No prompts</div>
        )}
      </div>
    </div>
  );
}
