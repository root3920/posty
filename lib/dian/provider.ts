import { AlegraProvider } from './alegra-provider';
import type { DianProvider } from './types';

export function getDianProvider(providerName: string, apiKey: string): DianProvider {
  switch (providerName) {
    case 'alegra':
      return new AlegraProvider(apiKey);
    default:
      throw new Error(`Proveedor DIAN no soportado: ${providerName}. Opciones: alegra, siigo, factory_hka`);
  }
}
