export interface InvoiceData {
  invoiceNumber: string;
  prefix?: string;
  invoiceDate: string;
  dueDate?: string;
  issuer: { nit: string; name: string; address?: string; regime?: string; ciiu?: string };
  customer: { name: string; nit?: string; documentType?: string; documentNumber?: string; email?: string; address?: string };
  lines: Array<{ description: string; quantity: number; unitPrice: number; discount?: number; taxRate: number; taxAmount: number; total: number }>;
  totals: { subtotal: number; taxBase: number; ivaAmount: number; icaAmount?: number; consumptionTax?: number; withholding?: number; total: number };
  paymentMethod?: string;
  paymentMeans?: string;
  notes?: string;
}

export interface InvoiceResult {
  cufe?: string;
  qrCodeUrl?: string;
  pdfUrl?: string;
  status: 'validated' | 'rejected' | 'pending';
  message?: string;
}

export interface DianProvider {
  createInvoice(data: InvoiceData): Promise<InvoiceResult>;
  cancelInvoice(invoiceId: string, reason: string): Promise<{ success: boolean }>;
  getStatus(invoiceId: string): Promise<InvoiceResult>;
  downloadPdf(invoiceId: string): Promise<string>; // URL
}
