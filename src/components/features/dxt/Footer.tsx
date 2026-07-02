import type { z } from 'zod';
import type { DxtManifestSchema } from './schemas';

// Footer component for displaying manifest details
export function Footer({ manifest }: { manifest: z.infer<typeof DxtManifestSchema> }) {
  return (
    <footer className="mt-2 border-t pt-2 text-sm">
      <div>Details</div>
      <div className="grid grid-cols-2">
        <div className="text-gray-600 py-2">
          <div>Version</div>
          <div>{manifest.version ?? ''}</div>
        </div>
        {/* License */}
        <div className="text-gray-600 py-2">
          <div>License</div>
          <div>{manifest.license ?? 'N/A'}</div>
        </div>
        <div className="text-gray-600 py-2">
          <div>Author</div>
          <div>{manifest.author?.name ?? ''}</div>
        </div>
        <div className="text-gray-600 py-2">
          <div>Documents</div>
          <div>{manifest.documentation ?? ''}</div>
          <div>{manifest.support ?? ''}</div>
        </div>
      </div>
    </footer>
  );
}
