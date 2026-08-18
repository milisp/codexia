import type React from 'react';

interface InfoRowProps {
  label: string;
  children: React.ReactNode;
}

export function InfoRow({ label, children }: InfoRowProps) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{children}</span>
    </>
  );
}
