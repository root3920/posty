interface GuestNameProps {
  firstName: string;
  lastName: string;
  documentNumber?: string | null;
  className?: string;
}

export function GuestName({ firstName, lastName, documentNumber, className }: GuestNameProps) {
  return (
    <span className={className}>
      <span className="font-medium">{lastName}, {firstName}</span>
      {documentNumber && (
        <span className="ml-1.5 text-xs text-muted-foreground">{documentNumber}</span>
      )}
    </span>
  );
}
