import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <Image
        src="/brand/posty-cat-black.png"
        alt="POSTY"
        width={80}
        height={80}
        className="opacity-40 dark:hidden"
      />
      <Image
        src="/brand/posty-cat-white.png"
        alt="POSTY"
        width={80}
        height={80}
        className="hidden opacity-40 dark:block"
      />
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold">No encontramos esta página</h1>
        <p className="text-muted-foreground text-sm">
          La dirección no existe o fue movida.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex h-10 items-center justify-center rounded-[10px] bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
