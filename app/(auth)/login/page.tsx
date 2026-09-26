export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="space-y-2 text-center">
          <div className="bg-primary text-primary-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold">
            P
          </div>
          <h1 className="text-2xl font-bold tracking-tight">POSTY</h1>
          <p className="text-muted-foreground text-sm">Gestión Hotelera</p>
        </div>
        <p className="text-muted-foreground text-center text-sm">
          Formulario de login — se implementa en Fase 2.
        </p>
      </div>
    </div>
  );
}
