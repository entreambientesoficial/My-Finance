export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { unauthorized, serverError } from '@/lib/api-response';

// ─── Color palette ───────────────────────────────────────────────
const C_NAVY    = rgb(0.012, 0.086, 0.196);   // #031632
const C_BLUE    = rgb(0.227, 0.478, 0.914);   // #3A7AE9
const C_WHITE   = rgb(1, 1, 1);
const C_GRAY    = rgb(0.42, 0.47, 0.56);
const C_LGRAY   = rgb(0.72, 0.76, 0.82);
const C_GREEN   = rgb(0.055, 0.537, 0.357);   // #0E8960
const C_RED     = rgb(0.859, 0.196, 0.196);   // #DB3232
const C_BG      = rgb(0.965, 0.969, 0.976);   // #F6F7F9
const C_BORDER  = rgb(0.878, 0.898, 0.929);   // #E0E5ED
const C_AMBER   = rgb(0.855, 0.647, 0.125);   // #DAA520

// ─── Helpers ─────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR');

async function getCashFlow(householdId: string, months: number) {
  const supabase = createAdminClient();
  const now = new Date();
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
    const end   = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const { data: rows } = await supabase
      .from('transactions').select('type, amount')
      .eq('householdId', householdId).eq('isPaid', true)
      .gte('date', start).lte('date', end);
    const income   = (rows ?? []).filter(r => r.type === 'INCOME').reduce((s, r) => s + Number(r.amount), 0);
    const expenses = (rows ?? []).filter(r => r.type === 'EXPENSE').reduce((s, r) => s + Number(r.amount), 0);
    result.push({
      label: date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', ''),
      income, expenses, balance: income - expenses,
    });
  }
  return result;
}

// ─── PDF drawing helpers ──────────────────────────────────────────
function sectionTitle(page: any, y: number, text: string, bold: any) {
  // accent stripe
  page.drawRectangle({ x: 40, y: y - 14, width: 4, height: 18, color: C_BLUE });
  page.drawText(text.toUpperCase(), { x: 50, y, size: 9, font: bold, color: C_NAVY, characterSpacing: 1 });
  // underline
  page.drawLine({ start: { x: 40, y: y - 18 }, end: { x: 555, y: y - 18 }, thickness: 0.5, color: C_BORDER });
}

function tableRow(page: any, y: number, cols: { text: string; x: number; align?: 'left' | 'right'; color?: any; font: any; size?: number }[], rowBg?: any) {
  if (rowBg) page.drawRectangle({ x: 40, y: y - 12, width: 515, height: 18, color: rowBg });
  for (const col of cols) {
    const f = col.font;
    const sz = col.size ?? 9;
    const color = col.color ?? C_NAVY;
    if (col.align === 'right') {
      const w = f.widthOfTextAtSize(col.text, sz);
      page.drawText(col.text, { x: col.x - w, y, size: sz, font: f, color });
    } else {
      page.drawText(col.text, { x: col.x, y, size: sz, font: f, color });
    }
  }
}

// ─── Route ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return unauthorized();
      const householdId = user.householdId;
      const now = new Date();
      const supabase = createAdminClient();

      // ── Fetch data ─────────────────────────────────────────────
      const [{ data: household }, { data: accounts }, cashFlow, { data: upcomingBills }] = await Promise.all([
        supabase.from('households').select('*').eq('id', householdId).maybeSingle(),
        supabase.from('accounts').select('name, type, balance').eq('householdId', householdId).eq('isActive', true),
        getCashFlow(householdId, 3),
        supabase.from('transactions')
          .select('description, amount, date, category:categories(name)')
          .eq('householdId', householdId).eq('type', 'EXPENSE').eq('isPaid', false)
          .gte('date', new Date().toISOString())
          .lte('date', new Date(Date.now() + 30 * 864e5).toISOString())
          .order('date', { ascending: true }).limit(10),
      ]);

      const bankBalance = (accounts ?? []).reduce((s, a) => s + Number(a.balance), 0);

      // Accurate investment value via portfolio API
      let investmentValue = 0;
      try {
        const origin = new URL(req.url).origin;
        const pRes = await fetch(`${origin}/api/investments/portfolio`, {
          headers: { cookie: req.headers.get('cookie') || '' },
        });
        if (pRes.ok) investmentValue = Number((await pRes.json()).totalCurrent ?? 0);
      } catch { /* fallback = 0 */ }

      const netWorth = bankBalance + investmentValue;

      // ── Build PDF ──────────────────────────────────────────────
      const pdfDoc = await PDFDocument.create();
      const W = 595, H = 842;
      const page = pdfDoc.addPage([W, H]);
      const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Attempt to embed logo from public folder
      let logoImage: any = null;
      let logoDims = { width: 0, height: 0 };
      try {
        const origin = new URL(req.url).origin;
        const logoRes = await fetch(`${origin}/logo-dark.png`);
        if (logoRes.ok) {
          const logoBytes = await logoRes.arrayBuffer();
          logoImage = await pdfDoc.embedPng(logoBytes);
          const scaled = logoImage.scaleToFit(130, 36);
          logoDims = { width: scaled.width, height: scaled.height };
        }
      } catch { /* no logo */ }

      // ── HEADER ─────────────────────────────────────────────────
      const HDR_H = 88;
      page.drawRectangle({ x: 0, y: H - HDR_H, width: W, height: HDR_H, color: C_NAVY });
      // thin accent line at bottom of header
      page.drawRectangle({ x: 0, y: H - HDR_H, width: W, height: 3, color: C_BLUE });

      if (logoImage) {
        page.drawImage(logoImage, {
          x: 40,
          y: H - HDR_H / 2 - logoDims.height / 2 + 2,
          width: logoDims.width,
          height: logoDims.height,
        });
      } else {
        page.drawText('MY FINANCE', { x: 40, y: H - 42, size: 18, font: bold, color: C_WHITE });
      }

      // Right side header info
      const houseName = household?.name || '';
      const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      const titleText = 'Relatório Financeiro Resumido';
      const titleW = bold.widthOfTextAtSize(titleText, 12);
      page.drawText(titleText, { x: W - 40 - titleW, y: H - 34, size: 12, font: bold, color: C_WHITE });
      const subW = regular.widthOfTextAtSize(houseName, 9);
      if (houseName) page.drawText(houseName, { x: W - 40 - subW, y: H - 50, size: 9, font: regular, color: C_LGRAY });
      const dateW = regular.widthOfTextAtSize(dateStr, 8);
      page.drawText(dateStr, { x: W - 40 - dateW, y: H - 65, size: 8, font: regular, color: C_LGRAY });

      // ── PATRIMÔNIO ─────────────────────────────────────────────
      let y = H - HDR_H - 30;
      sectionTitle(page, y, 'Patrimônio Líquido', bold);
      y -= 28;

      // 3 summary cards
      const summaryCards = [
        { label: 'Saldo em Contas', value: fmt(bankBalance), color: C_BLUE },
        { label: 'Investimentos',   value: fmt(investmentValue), color: C_GREEN },
        { label: 'Patrimônio Total', value: fmt(netWorth), color: C_NAVY },
      ];
      const cardW = 160, cardGap = 9;
      summaryCards.forEach((card, i) => {
        const cx = 40 + i * (cardW + cardGap);
        page.drawRectangle({ x: cx, y: y - 46, width: cardW, height: 52, color: C_BG });
        page.drawRectangle({ x: cx, y: y + 6 - 46 + 46, width: cardW, height: 3, color: card.color });
        page.drawText(card.label, { x: cx + 10, y: y - 10, size: 8, font: regular, color: C_GRAY });
        page.drawText(card.value, { x: cx + 10, y: y - 28, size: 11, font: bold, color: card.color });
      });
      y -= 64;

      // ── CONTAS BANCÁRIAS ───────────────────────────────────────
      if ((accounts ?? []).length > 0) {
        y -= 14;
        sectionTitle(page, y, 'Contas Bancárias', bold);
        y -= 24;

        const ACCOUNT_TYPE: Record<string, string> = {
          CHECKING: 'Conta Corrente', SAVINGS: 'Poupança',
          INVESTMENT: 'Investimento', CASH: 'Dinheiro', OTHER: 'Outra',
        };
        (accounts ?? []).forEach((acc, idx) => {
          const bg = idx % 2 === 0 ? undefined : C_BG;
          tableRow(page, y, [
            { text: acc.name, x: 50, font: regular, size: 9, color: C_NAVY },
            { text: ACCOUNT_TYPE[acc.type] || acc.type, x: 280, font: regular, size: 8, color: C_GRAY },
            { text: fmt(Number(acc.balance)), x: 555, align: 'right', font: bold, size: 9, color: Number(acc.balance) >= 0 ? C_GREEN : C_RED },
          ], bg);
          y -= 18;
        });

        // total line
        page.drawLine({ start: { x: 40, y: y + 10 }, end: { x: 555, y: y + 10 }, thickness: 0.5, color: C_BORDER });
        const totalW = bold.widthOfTextAtSize(fmt(bankBalance), 9);
        page.drawText('Total', { x: 50, y: y - 4, size: 9, font: bold, color: C_NAVY });
        page.drawText(fmt(bankBalance), { x: 555 - totalW, y: y - 4, size: 9, font: bold, color: bankBalance >= 0 ? C_GREEN : C_RED });
        y -= 20;
      }

      // ── FLUXO DE CAIXA ─────────────────────────────────────────
      y -= 14;
      sectionTitle(page, y, 'Fluxo de Caixa — Últimos 3 Meses', bold);
      y -= 24;

      // Table header
      page.drawRectangle({ x: 40, y: y - 12, width: 515, height: 18, color: C_NAVY });
      page.drawText('Mês',      { x: 50,  y, size: 8, font: bold, color: C_WHITE });
      page.drawText('Receitas', { x: 220, y, size: 8, font: bold, color: C_WHITE });
      page.drawText('Despesas', { x: 340, y, size: 8, font: bold, color: C_WHITE });
      page.drawText('Saldo',    { x: 460, y, size: 8, font: bold, color: C_WHITE });
      y -= 20;

      if (cashFlow.every(r => r.income === 0 && r.expenses === 0)) {
        page.drawText('Nenhuma transação confirmada no período.', { x: 50, y, size: 9, font: regular, color: C_GRAY });
        y -= 20;
      } else {
        cashFlow.forEach((row, idx) => {
          const bg = idx % 2 === 0 ? C_BG : undefined;
          tableRow(page, y, [
            { text: row.label, x: 50, font: regular, size: 9 },
            { text: fmt(row.income),   x: 310, align: 'right', font: regular, size: 9, color: C_GREEN },
            { text: fmt(row.expenses), x: 430, align: 'right', font: regular, size: 9, color: C_RED },
            { text: fmt(row.balance),  x: 555, align: 'right', font: bold,    size: 9, color: row.balance >= 0 ? C_GREEN : C_RED },
          ], bg);
          y -= 18;
        });
      }

      // ── PRÓXIMAS CONTAS ────────────────────────────────────────
      if ((upcomingBills ?? []).length > 0) {
        y -= 14;
        sectionTitle(page, y, 'Próximas Contas a Pagar — 30 Dias', bold);
        y -= 24;

        page.drawRectangle({ x: 40, y: y - 12, width: 515, height: 18, color: C_NAVY });
        page.drawText('Descrição',  { x: 50,  y, size: 8, font: bold, color: C_WHITE });
        page.drawText('Categoria',  { x: 280, y, size: 8, font: bold, color: C_WHITE });
        page.drawText('Vencimento', { x: 420, y, size: 8, font: bold, color: C_WHITE });
        page.drawText('Valor',      { x: 555, y, size: 8, font: bold, color: C_WHITE, });
        y -= 20;

        let billsTotal = 0;
        (upcomingBills ?? []).forEach((bill: any, idx) => {
          const bg = idx % 2 === 0 ? C_BG : undefined;
          const desc = (bill.description || 'Lançamento').slice(0, 34);
          const catName = (bill.category?.name || '—').slice(0, 20);
          const amount = Number(bill.amount);
          billsTotal += amount;
          tableRow(page, y, [
            { text: desc,              x: 50,  font: regular, size: 9 },
            { text: catName,           x: 280, font: regular, size: 8, color: C_GRAY },
            { text: fmtDate(bill.date),x: 420, font: regular, size: 9, color: C_AMBER },
            { text: fmt(amount),       x: 555, align: 'right', font: bold, size: 9, color: C_RED },
          ], bg);
          y -= 18;
        });

        // bills total
        page.drawLine({ start: { x: 40, y: y + 10 }, end: { x: 555, y: y + 10 }, thickness: 0.5, color: C_BORDER });
        const btW = bold.widthOfTextAtSize(fmt(billsTotal), 9);
        page.drawText('Total a pagar', { x: 50, y: y - 4, size: 9, font: bold, color: C_NAVY });
        page.drawText(fmt(billsTotal), { x: 555 - btW, y: y - 4, size: 9, font: bold, color: C_RED });
        y -= 18;
      }

      // ── FOOTER ─────────────────────────────────────────────────
      const footerY = 36;
      page.drawLine({ start: { x: 40, y: footerY + 14 }, end: { x: 555, y: footerY + 14 }, thickness: 0.5, color: C_BORDER });
      page.drawText('Documento gerado automaticamente pelo sistema MY-FINANCE. Uso restrito ao titular da conta.', {
        x: 40, y: footerY + 4, size: 7, font: regular, color: C_LGRAY,
      });
      const genText = `Gerado em ${now.toLocaleString('pt-BR')}`;
      const genW = regular.widthOfTextAtSize(genText, 7);
      page.drawText(genText, { x: W - 40 - genW, y: footerY + 4, size: 7, font: regular, color: C_LGRAY });

      // ── Generate & return ──────────────────────────────────────
      const pdfBytes = await pdfDoc.save();
      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="relatorio-${now.toISOString().slice(0, 10)}.pdf"`,
        },
      });
    } catch (err) {
      console.error('[reports/export/pdf GET]', err);
      return serverError();
    }
  })(req);
}
