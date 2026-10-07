import { Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

interface TestEmailProps {
  hotelName: string;
  logoUrl?: string | null;
  brandColor?: string;
}

export function TestEmail({ hotelName, logoUrl, brandColor }: TestEmailProps) {
  return (
    <BaseLayout
      preview={`Correo de prueba — ${hotelName}`}
      hotelName={hotelName}
      logoUrl={logoUrl}
      brandColor={brandColor}
    >
      <Text style={title}>Correo de prueba</Text>
      <Text style={paragraph}>
        Este es un correo de prueba enviado desde POSTY. Si lo estás leyendo,
        la configuración de correo electrónico funciona correctamente.
      </Text>
      <Text style={paragraph}>
        Los correos que envíes a tus huéspedes se verán con este mismo diseño,
        usando el logo y los colores de tu hotel.
      </Text>
    </BaseLayout>
  );
}

export function testEmailText(hotelName: string): string {
  return [
    `Correo de prueba — ${hotelName}`,
    '',
    'Este es un correo de prueba enviado desde POSTY. Si lo estás leyendo,',
    'la configuración de correo electrónico funciona correctamente.',
    '',
    `Enviado por ${hotelName} vía POSTY`,
  ].join('\n');
}

// ─── Styles ──────────────────────────────────────────────────────────────

const title: React.CSSProperties = {
  fontSize: '18px',
  color: '#18181b',
  fontWeight: 600,
  margin: '0 0 12px',
};

const paragraph: React.CSSProperties = {
  fontSize: '14px',
  color: '#3f3f46',
  lineHeight: '22px',
  margin: '0 0 12px',
};
