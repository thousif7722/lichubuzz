'use strict';
const PDFDocument = require('pdfkit');
const dayjs = require('dayjs');

/**
 * Generates a GST-compliant PDF invoice for a completed booking
 */
async function generateInvoice({ booking, materials, transaction }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const colors = {
      primary: '#2563EB',
      secondary: '#64748B',
      success: '#16A34A',
      light: '#F8FAFC',
      border: '#E2E8F0',
      text: '#1E293B',
    };

    const pageWidth = doc.page.width - 100; // Accounting for margins

    // ── Header ──────────────────────────────────────────────────────────────────
    doc.rect(50, 50, pageWidth, 90).fill(colors.primary);
    doc.fillColor('white');
    doc.fontSize(24).font('Helvetica-Bold').text('SERVICEHUB', 60, 65);
    doc.fontSize(10).font('Helvetica').text('Professional Home Services', 60, 95);
    doc.fontSize(10).text('GST: 29XXXXX1234X1ZX | support@servicehub.in', 60, 110);

    // Invoice label
    doc.fontSize(20).font('Helvetica-Bold').text('TAX INVOICE', 370, 70, { width: 150, align: 'right' });
    doc.fontSize(10).font('Helvetica').text(`Invoice #: ${booking.bookingNumber}`, 370, 100, { width: 150, align: 'right' });
    doc.fontSize(10).text(`Date: ${dayjs(booking.workDetails?.completedAt || booking.updatedAt).format('DD MMM YYYY')}`, 370, 115, { width: 150, align: 'right' });

    doc.fillColor(colors.text);
    let y = 165;

    // ── Billing Info ────────────────────────────────────────────────────────────
    doc.roundedRect(50, y, pageWidth / 2 - 10, 110, 6).fill(colors.light);
    doc.roundedRect(50 + pageWidth / 2 + 10, y, pageWidth / 2 - 10, 110, 6).fill(colors.light);

    // Bill To
    doc.fillColor(colors.secondary).fontSize(9).font('Helvetica-Bold').text('BILL TO', 60, y + 10);
    doc.fillColor(colors.text).fontSize(11).font('Helvetica-Bold').text(booking.customerId?.name || 'Customer', 60, y + 25);
    doc.fontSize(9).font('Helvetica').fillColor(colors.secondary);
    doc.text(`Phone: ${booking.customerId?.phone || '—'}`, 60, y + 42);
    doc.text(`Email: ${booking.customerId?.email || '—'}`, 60, y + 57);
    doc.text(`Address: ${booking.serviceAddress?.line1}, ${booking.serviceAddress?.city}`, 60, y + 72, { width: pageWidth / 2 - 30 });

    // Service Provider
    const x2 = 50 + pageWidth / 2 + 20;
    doc.fillColor(colors.secondary).fontSize(9).font('Helvetica-Bold').text('SERVICE PROVIDER', x2, y + 10);
    doc.fillColor(colors.text).fontSize(11).font('Helvetica-Bold').text(booking.providerId?.name || 'Provider', x2, y + 25);
    doc.fontSize(9).font('Helvetica').fillColor(colors.secondary);
    doc.text(`Phone: ${booking.providerId?.phone || '—'}`, x2, y + 42);
    doc.text(`Service: ${booking.serviceId?.name || '—'}`, x2, y + 57);
    doc.text(`Booking Date: ${dayjs(booking.scheduledDate).format('DD MMM YYYY')}`, x2, y + 72);
    doc.text(`Time: ${booking.timeSlot?.from} - ${booking.timeSlot?.to}`, x2, y + 87);

    y += 130;

    // ── Services Table ──────────────────────────────────────────────────────────
    doc.fillColor(colors.text).fontSize(12).font('Helvetica-Bold').text('Services & Billing', 50, y);
    y += 15;

    // Table header
    doc.rect(50, y, pageWidth, 25).fill(colors.primary);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text('Description', 60, y + 8);
    doc.text('Qty', 320, y + 8, { width: 50, align: 'center' });
    doc.text('Unit Price', 370, y + 8, { width: 80, align: 'right' });
    doc.text('Amount', 450, y + 8, { width: 90, align: 'right' });
    y += 25;

    doc.fillColor(colors.text).font('Helvetica').fontSize(9);

    // Base service
    const baseAmount = booking.basePrice * (booking.surgeMultiplier || 1);
    addTableRow(doc, y, colors, {
      description: `${booking.serviceId?.name || 'Service'}${booking.surgeMultiplier > 1 ? ` (${booking.surgeMultiplier}x surge)` : ''}`,
      qty: 1,
      unitPrice: booking.basePrice,
      amount: baseAmount,
      pageWidth,
    });
    y += 28;

    // Materials
    if (materials?.items?.length > 0) {
      doc.fillColor(colors.secondary).fontSize(9).font('Helvetica-Bold').text('Materials Used:', 60, y);
      y += 15;
      doc.font('Helvetica');

      for (const item of materials.items) {
        doc.fillColor(colors.text);
        addTableRow(doc, y, colors, {
          description: `  • ${item.name}${item.brand ? ` (${item.brand})` : ''}`,
          qty: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
          unit: item.unit,
          pageWidth,
        });
        y += 25;
        if (y > 700) { doc.addPage(); y = 50; } // Page break
      }
    }

    // Extra charges
    if (booking.extraCharges > 0) {
      addTableRow(doc, y, colors, {
        description: booking.extraChargesNote || 'Additional charges',
        qty: 1,
        unitPrice: booking.extraCharges,
        amount: booking.extraCharges,
        pageWidth,
      });
      y += 28;
    }

    // ── Totals ──────────────────────────────────────────────────────────────────
    y += 10;
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).stroke(colors.border);
    y += 10;

    const totalsX = 350;
    const GST_RATE = 18;
    const subtotalBeforeGST = booking.totalAmount / (1 + GST_RATE / 100);
    const gstAmount = booking.totalAmount - subtotalBeforeGST;

    const addTotalRow = (label, value, bold = false, color = colors.text) => {
      if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.fillColor(colors.secondary).fontSize(9).text(label, totalsX, y);
      doc.fillColor(color).fontSize(9).text(`₹${value.toFixed(2)}`, totalsX + 120, y, { width: pageWidth - totalsX - 70, align: 'right' });
      y += 18;
    };

    addTotalRow('Subtotal (excl. GST)', subtotalBeforeGST);
    if (booking.discountAmount > 0) {
      addTotalRow(`Discount (${booking.couponCode || ''})`, -booking.discountAmount, false, colors.success);
    }
    addTotalRow(`GST @ ${GST_RATE}%`, gstAmount);
    doc.moveTo(totalsX, y).lineTo(50 + pageWidth, y).stroke(colors.border);
    y += 8;
    addTotalRow('TOTAL AMOUNT', booking.totalAmount, true, colors.primary);

    // ── Payment Info ────────────────────────────────────────────────────────────
    if (transaction) {
      y += 10;
      doc.rect(50, y, pageWidth, 40).fill('#F0FDF4');
      doc.fillColor(colors.success).fontSize(11).font('Helvetica-Bold').text('✓ PAID', 60, y + 8);
      doc.fillColor(colors.secondary).fontSize(9).font('Helvetica');
      doc.text(`Transaction ID: ${transaction.razorpayPaymentId || transaction.transactionId}`, 60, y + 24);
      doc.text(`Payment Mode: ${transaction.paymentMethod?.toUpperCase() || 'Online'}`, 300, y + 24);
      y += 55;
    }

    // ── Work Details ────────────────────────────────────────────────────────────
    if (booking.workDetails?.workPerformed) {
      doc.fillColor(colors.text).fontSize(10).font('Helvetica-Bold').text('Work Performed:', 50, y);
      y += 15;
      doc.fontSize(9).font('Helvetica').fillColor(colors.secondary)
        .text(booking.workDetails.workPerformed, 50, y, { width: pageWidth });
      y += 30;
    }

    // ── Footer ──────────────────────────────────────────────────────────────────
    doc.rect(50, doc.page.height - 80, pageWidth, 60).fill(colors.light);
    doc.fillColor(colors.secondary).fontSize(8).font('Helvetica')
      .text('Thank you for choosing ServiceHub! For support: 1800-XXX-XXXX | support@servicehub.in', 50, doc.page.height - 65, { width: pageWidth, align: 'center' })
      .text('This is a computer-generated invoice and does not require a signature.', 50, doc.page.height - 50, { width: pageWidth, align: 'center' });

    doc.end();
  });
}

function addTableRow(doc, y, colors, { description, qty, unitPrice, amount, unit = '', pageWidth }) {
  const isEvenRow = Math.floor(y / 28) % 2 === 0;
  if (isEvenRow) doc.rect(50, y - 5, pageWidth, 27).fill('#FAFAFA');

  doc.fillColor('#1E293B').font('Helvetica').fontSize(9);
  doc.text(description, 60, y, { width: 255 });
  doc.text(`${qty} ${unit}`, 320, y, { width: 50, align: 'center' });
  doc.text(`₹${Number(unitPrice).toFixed(2)}`, 370, y, { width: 80, align: 'right' });
  doc.text(`₹${Number(amount).toFixed(2)}`, 450, y, { width: 90, align: 'right' });
}

module.exports = { generateInvoice };
