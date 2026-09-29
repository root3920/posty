'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GuestJourneyTab } from '@/components/configuracion/guest-journey-tab';
import { RecurringTasksTab } from '@/components/configuracion/recurring-tasks-tab';
import HousekeepingSettingsTab from '@/components/configuracion/housekeeping-settings-tab';

export default function TareasAutomaticasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Tareas automáticas
        </h1>
        <p className="text-muted-foreground text-sm">
          Configura las tareas que se crean solas según el recorrido del
          huésped, tareas recurrentes y limpieza.
        </p>
      </div>

      <Tabs defaultValue="journey" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto scrollbar-none">
          <TabsTrigger value="journey">Recorrido del huésped</TabsTrigger>
          <TabsTrigger value="recurring">Tareas recurrentes</TabsTrigger>
          <TabsTrigger value="housekeeping">Limpieza</TabsTrigger>
        </TabsList>

        <TabsContent value="journey" className="mt-6">
          <GuestJourneyTab />
        </TabsContent>

        <TabsContent value="recurring" className="mt-6">
          <RecurringTasksTab />
        </TabsContent>

        <TabsContent value="housekeeping" className="mt-6">
          <HousekeepingSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
