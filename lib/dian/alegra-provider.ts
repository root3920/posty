import type { DianProvider, InvoiceData, InvoiceResult } from './types';

export class AlegraProvider implements DianProvider {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiUrl = 'https://api.alegra.com/api/v1';
    this.apiKey = apiKey;
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Basic ${this.apiKey}`,
    };
  }

  async createInvoice(data: InvoiceData): Promise<InvoiceResult> {
    // Map POSTY invoice to Alegra format
    const alegraInvoice = {
      date: data.invoiceDate,
      dueDate: data.dueDate,
      client: {
        name: data.customer.name,
        identification: data.customer.nit ?? data.customer.documentNumber,
        email: data.customer.email,
      },
      items: data.lines.map((line) => ({
        name: line.description,
        quantity: line.quantity,
        price: line.unitPrice,
        discount: line.discount ?? 0,
        tax: [{ id: 1, percentage: line.taxRate }],
      })),
      stamp: { generateStamp: true },
      paymentMethod: data.paymentMethod ?? 'CASH',
    };

    console.log('[Alegra] Creating invoice:', JSON.stringify(alegraInvoice).slice(0, 200));

    const res = await fetch(`${this.apiUrl}/invoices`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(alegraInvoice),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('[Alegra] Error:', error);
      return { status: 'rejected', message: `Error del proveedor: ${res.status}` };
    }

    const result = await res.json();
    return {
      cufe: result.stamp?.cufe ?? null,
      qrCodeUrl: result.stamp?.qrCode ?? null,
      pdfUrl: result.pdfUrl ?? null,
      status: result.stamp?.cufe ? 'validated' : 'pending',
    };
  }

  async cancelInvoice(_invoiceId: string, _reason: string): Promise<{ success: boolean }> {
    // Alegra: create a credit note
    return { success: false }; // TODO: implement
  }

  async getStatus(_invoiceId: string): Promise<InvoiceResult> {
    return { status: 'pending' };
  }

  async downloadPdf(_invoiceId: string): Promise<string> {
    return ''; // TODO: implement
  }
}
