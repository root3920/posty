import { EvolutionProvider } from './evolution-provider';
import type { WhatsAppProvider } from './types';

export function getWhatsAppProvider(): WhatsAppProvider {
  const url = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  if (!url || !key) throw new Error('EVOLUTION_API_URL and EVOLUTION_API_KEY are required');
  return new EvolutionProvider(url, key);
}
