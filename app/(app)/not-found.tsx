import Image from 'next/image';
import Link from 'next/link';

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <Image
        src="/brand/posty-cat-black.png"
        alt="POSTY"
        width={64}
        height={64}
        className="opacity-30 dark:hidden"
      />
      <Image
        src="/brand/posty-cat-white.png"
        alt="POSTY"
        width={64}
        height={64}
        className="hidden opacity-30 dark:block"
      />
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold">No encontramos esta página</h1>
        <p className="text-muted-foreground text-sm">
          La dirección no existe o fue movida.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
