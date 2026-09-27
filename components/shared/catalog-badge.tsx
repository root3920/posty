interface CatalogBadgeProps {
  name: string;
  color?: string;
  className?: string;
}

export function CatalogBadge({ name, color, className }: CatalogBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${className ?? ''}`}
      style={color ? { backgroundColor: `${color}15`, color } : undefined}
    >
      {color && (
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      )}
      {name}
    </span>
  );
}
