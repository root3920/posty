import { Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

interface ManualEmailProps {
  hotelName: string;
  logoUrl?: string | null;
  brandColor?: string;
  guestName: string;
  subject: string;
  body: string;
}

export function ManualEmail({
  hotelName,
  logoUrl,
  brandColor,
  guestName,
  subject,
  body,
}: ManualEmailProps) {
  return (
    <BaseLayout
      preview={subject}
      hotelName={hotelName}
      logoUrl={logoUrl}
      brandColor={brandColor}
    >
      <Text style={greeting}>Hola {guestName},</Text>
      {body.split('\n').map((line, i) => (
        <Text key={i} style={paragraph}>
          {line || '\u00A0'}
        </Text>
      ))}
      <Text style={signoff}>Atentamente,</Text>
      <Text style={signoffName}>{hotelName}</Text>
    </BaseLayout>
  );
}

export function manualEmailText(params: ManualEmailProps): string {
  return [
    `Hola ${params.guestName},`,
    '',
    params.body,
    '',
    'Atentamente,',
    params.hotelName,
    '',
    `---`,
    `Enviado por ${params.hotelName} vía POSTY`,
    'Puedes responder directamente a este correo.',
  ].join('\n');
}

// ─── Styles ──────────────────────────────────────────────────────────────

const greeting: React.CSSProperties = {
  fontSize: '15px',
  color: '#18181b',
  margin: '0 0 16px',
  fontWeight: 500,
};

const paragraph: React.CSSProperties = {
  fontSize: '14px',
  color: '#3f3f46',
  lineHeight: '22px',
  margin: '0 0 8px',
};

const signoff: React.CSSProperties = {
  fontSize: '14px',
  color: '#3f3f46',
  margin: '20px 0 2px',
};

const signoffName: React.CSSProperties = {
  fontSize: '14px',
  color: '#18181b',
  fontWeight: 600,
  margin: '0',
};
