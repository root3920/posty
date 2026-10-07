import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import type { ReactNode } from 'react';

interface BaseLayoutProps {
  preview: string;
  hotelName: string;
  logoUrl?: string | null;
  brandColor?: string;
  children: ReactNode;
}

export function BaseLayout({
  preview,
  hotelName,
  logoUrl,
  brandColor = '#9c0b21',
  children,
}: BaseLayoutProps) {
  return (
    <Html lang="es">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header with brand color */}
          <Section style={{ ...header, backgroundColor: brandColor }}>
            {logoUrl ? (
              <Img
                src={logoUrl}
                alt={hotelName}
                width="48"
                height="48"
                style={{ borderRadius: '8px', objectFit: 'contain' }}
              />
            ) : (
              <Text style={hotelInitial}>
                {hotelName.charAt(0).toUpperCase()}
              </Text>
            )}
            <Text style={hotelNameStyle}>{hotelName}</Text>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footer}>
            <Text style={footerText}>
              Enviado por {hotelName} vía POSTY
            </Text>
            <Text style={footerDisclaimer}>
              Este correo fue enviado desde una dirección que no recibe respuestas.
              Si deseas comunicarte con el hotel, responde directamente a este correo.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily:
    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: '20px 0',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  maxWidth: '580px',
  margin: '0 auto',
  overflow: 'hidden',
  border: '1px solid #e5e5e5',
};

const header: React.CSSProperties = {
  padding: '24px 32px',
  textAlign: 'center' as const,
};

const hotelInitial: React.CSSProperties = {
  display: 'inline-block',
  width: '48px',
  height: '48px',
  lineHeight: '48px',
  borderRadius: '8px',
  backgroundColor: 'rgba(255,255,255,0.2)',
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 700,
  textAlign: 'center' as const,
  margin: '0 auto',
};

const hotelNameStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 600,
  margin: '8px 0 0',
};

const content: React.CSSProperties = {
  padding: '28px 32px',
};

const divider: React.CSSProperties = {
  borderTop: '1px solid #e5e5e5',
  margin: '0',
};

const footer: React.CSSProperties = {
  padding: '16px 32px 20px',
};

const footerText: React.CSSProperties = {
  color: '#71717a',
  fontSize: '12px',
  margin: '0 0 4px',
  textAlign: 'center' as const,
};

const footerDisclaimer: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '11px',
  margin: 0,
  textAlign: 'center' as const,
  lineHeight: '16px',
};
