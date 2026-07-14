export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { unauthorized, serverError } from '@/lib/api-response';

// ─── Palette ─────────────────────────────────────────────────────────────────
const C_NAVY   = rgb(0.012, 0.086, 0.196);
const C_BLUE   = rgb(0.227, 0.478, 0.914);
const C_WHITE  = rgb(1, 1, 1);
const C_GRAY   = rgb(0.42, 0.47, 0.56);
const C_LGRAY  = rgb(0.72, 0.76, 0.82);
const C_GLRAY2 = rgb(0.88, 0.90, 0.93);
const C_GREEN  = rgb(0.055, 0.537, 0.357);
const C_RED    = rgb(0.859, 0.196, 0.196);
const C_BG     = rgb(0.965, 0.969, 0.976);
const C_BORDER = rgb(0.878, 0.898, 0.929);
const C_AMBER  = rgb(0.855, 0.647, 0.125);

// ─── Page constants ───────────────────────────────────────────────────────────
const W = 595, H = 842;
const ML = 40, MR = 555;
const HDR_H   = 88;
const FOOTER_Y = 52;
const ROW_H    = 20;   // standard row height
// Text offset from row cursor: draws at y-TEXT_OFF so text is vertically centered in ROW_H
// For size 9 (cap ~6.4pt, descender ~2pt) in 20pt row: padding=(20-8.4)/2=5.8 → baseline=rect_bottom+5.8+2=rect_bottom+7.8
// rect from y-12 to y+8 → baseline at y-12+7.8 = y-4.2 ≈ cursor-4
const TEXT_OFF = 4;

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmt     = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR');
const clip    = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + '…' : s;
const pctStr  = (part: number, total: number) => total > 0 ? ((part / total) * 100).toFixed(1) + '%' : '—';

// ─── Data helpers ─────────────────────────────────────────────────────────────
const getCashFlow = async (householdId: string) => {
  const supabase = createAdminClient();
  const now = new Date();
  const rows: { label: string; income: number; expenses: number; balance: number; hasData: boolean }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const { data } = await supabase
      .from('transactions').select('type, amount')
      .eq('householdId', householdId).eq('isPaid', true)
      .gte('date', start).lte('date', end);
    const income   = (data ?? []).filter(r => r.type === 'INCOME').reduce((s, r) => s + Number(r.amount), 0);
    const expenses = (data ?? []).filter(r => r.type === 'EXPENSE').reduce((s, r) => s + Number(r.amount), 0);
    const label    = d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
    rows.push({ label, income, expenses, balance: income - expenses, hasData: income > 0 || expenses > 0 });
  }
  return rows;
};

const getExpensesByCategory = async (householdId: string, startDate: string, endDate: string) => {
  const supabase = createAdminClient();
  const [{ data: allCats }, { data: txs }] = await Promise.all([
    supabase.from('categories').select('id, name, parentId').eq('householdId', householdId),
    supabase.from('transactions')
      .select('amount, categoryId').eq('householdId', householdId).eq('type', 'EXPENSE')
      .gte('date', startDate).lte('date', endDate),
  ]);
  const catById: Record<string, any> = {};
  for (const c of allCats ?? []) catById[c.id] = c;
  const spent: Record<string, number> = {};
  for (const t of txs ?? []) {
    const cat = t.categoryId ? catById[t.categoryId] : null;
    const top = cat ? (cat.parentId && catById[cat.parentId] ? catById[cat.parentId] : cat) : null;
    const key = top?.id ?? '__other';
    spent[key] = (spent[key] || 0) + Number(t.amount);
  }
  const result: { name: string; total: number }[] = [];
  for (const c of (allCats ?? []).filter((c: any) => !c.parentId)) {
    if (spent[c.id]) result.push({ name: c.name, total: spent[c.id] });
  }
  if (spent['__other']) result.push({ name: 'Sem categoria', total: spent['__other'] });
  return result.sort((a, b) => b.total - a.total);
};

// ─── Route ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return unauthorized();
      const householdId = user.householdId;
      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const supabase   = createAdminClient();

      const [
        { data: household },
        { data: accounts },
        cashFlow,
        { data: upcomingBills },
        byCategory,
      ] = await Promise.all([
        supabase.from('households').select('*').eq('id', householdId).maybeSingle(),
        supabase.from('accounts').select('name, type, balance').eq('householdId', householdId).eq('isActive', true),
        getCashFlow(householdId),
        supabase.from('transactions')
          .select('description, amount, date, category:categories(name)')
          .eq('householdId', householdId).eq('type', 'EXPENSE').eq('isPaid', false)
          .gte('date', now.toISOString())
          .lte('date', new Date(Date.now() + 30 * 864e5).toISOString())
          .order('date', { ascending: true }).limit(10),
        getExpensesByCategory(householdId, monthStart, monthEnd),
      ]);

      const bankBalance = (accounts ?? []).reduce((s, a) => s + Number(a.balance), 0);
      let investmentValue = 0;
      try {
        const origin = new URL(req.url).origin;
        const pRes   = await fetch(`${origin}/api/investments/portfolio`, {
          headers: { cookie: req.headers.get('cookie') || '' },
        });
        if (pRes.ok) investmentValue = Number((await pRes.json()).totalCurrent ?? 0);
      } catch { /* fallback */ }
      const netWorth = bankBalance + investmentValue;

      // Current month data (last entry in cashFlow, which is always the current month)
      const curMonth = cashFlow[cashFlow.length - 1];

      // ── PDF setup ─────────────────────────────────────────────────────────
      const pdfDoc  = await PDFDocument.create();
      const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      let pg: any       = null;
      let y             = 0;
      let firstPage     = true;
      let activeHdrCols: any[] | null = null;

      // ── addPage: creates new page, draws footer, redraws active table header ──
      const addPage = () => {
        pg = pdfDoc.addPage([W, H]);
        pg.drawLine({ start: { x: ML, y: FOOTER_Y - 2 }, end: { x: MR, y: FOOTER_Y - 2 }, thickness: 0.4, color: C_BORDER });
        pg.drawText('Documento gerado automaticamente pelo sistema MY-FINANCE. Uso restrito ao titular da conta.', {
          x: ML, y: FOOTER_Y - 14, size: 6.5, font: regular, color: C_LGRAY,
        });
        const genText = `Gerado em ${now.toLocaleString('pt-BR')}`;
        pg.drawText(genText, { x: MR - regular.widthOfTextAtSize(genText, 6.5), y: FOOTER_Y - 14, size: 6.5, font: regular, color: C_LGRAY });
        y = firstPage ? H - HDR_H - 28 : H - 36;
        firstPage = false;
        // Redraw active table header so rows remain readable after page break
        if (activeHdrCols) {
          pg.drawRectangle({ x: ML, y: y - 12, width: MR - ML, height: ROW_H, color: C_NAVY });
          for (const col of activeHdrCols) {
            const sz = col.size ?? 8;
            const tx = col.text;
            if (col.align === 'right') {
              pg.drawText(tx, { x: col.x - bold.widthOfTextAtSize(tx, sz), y: y - TEXT_OFF + 1, size: sz, font: bold, color: C_WHITE });
            } else {
              pg.drawText(tx, { x: col.x, y: y - TEXT_OFF + 1, size: sz, font: bold, color: C_WHITE });
            }
          }
          y -= ROW_H + 2;
        }
      };

      const ensureSpace = (needed: number) => {
        if (y - needed < FOOTER_Y + 8) addPage();
      };

      // ── First page ────────────────────────────────────────────────────────
      addPage();

      // Header
      pg.drawRectangle({ x: 0, y: H - HDR_H, width: W, height: HDR_H, color: C_NAVY });
      pg.drawRectangle({ x: 0, y: H - HDR_H, width: W, height: 3, color: C_BLUE });

      let logoImage: any = null, logoDims = { width: 0, height: 0 };
      try {
        const origin  = new URL(req.url).origin;
        const logoRes = await fetch(`${origin}/logo-dark.png`);
        if (logoRes.ok) {
          logoImage = await pdfDoc.embedPng(await logoRes.arrayBuffer());
          const s   = logoImage.scaleToFit(130, 36);
          logoDims  = { width: s.width, height: s.height };
        }
      } catch { /* no logo */ }

      if (logoImage) {
        pg.drawImage(logoImage, { x: ML, y: H - HDR_H / 2 - logoDims.height / 2 + 2, width: logoDims.width, height: logoDims.height });
      } else {
        pg.drawText('MY FINANCE', { x: ML, y: H - 44, size: 18, font: bold, color: C_WHITE });
      }

      const titleText = 'Relatório Financeiro Resumido';
      const houseName = household?.name ?? '';
      const dateStr   = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      pg.drawText(titleText, { x: MR - bold.widthOfTextAtSize(titleText, 12), y: H - 34, size: 12, font: bold, color: C_WHITE });
      if (houseName) pg.drawText(houseName, { x: MR - regular.widthOfTextAtSize(houseName, 9), y: H - 50, size: 9, font: regular, color: C_LGRAY });
      pg.drawText(dateStr, { x: MR - regular.widthOfTextAtSize(dateStr, 8), y: H - 66, size: 8, font: regular, color: C_LGRAY });

      // ── Drawing helpers ───────────────────────────────────────────────────
      type Col = { text: string; x: number; align?: 'left' | 'right'; color?: any; isBold?: boolean; size?: number };

      const sectionGap = (extra = 0) => { y -= (10 + extra); };

      const drawSectionTitle = (text: string) => {
        ensureSpace(56);
        pg.drawRectangle({ x: ML, y: y - 16, width: 4, height: 21, color: C_BLUE });
        pg.drawText(text.toUpperCase(), { x: ML + 10, y: y - 4, size: 9, font: bold, color: C_NAVY });
        pg.drawLine({ start: { x: ML, y: y - 20 }, end: { x: MR, y: y - 20 }, thickness: 0.4, color: C_BORDER });
        y -= 32;
      };

      const drawHeaderRow = (cols: Col[]) => {
        ensureSpace(ROW_H + 4);
        activeHdrCols = cols;
        pg.drawRectangle({ x: ML, y: y - 12, width: MR - ML, height: ROW_H, color: C_NAVY });
        for (const col of cols) {
          const sz = col.size ?? 8;
          if (col.align === 'right') {
            pg.drawText(col.text, { x: col.x - bold.widthOfTextAtSize(col.text, sz), y: y - TEXT_OFF + 1, size: sz, font: bold, color: C_WHITE });
          } else {
            pg.drawText(col.text, { x: col.x, y: y - TEXT_OFF + 1, size: sz, font: bold, color: C_WHITE });
          }
        }
        y -= ROW_H + 2;
      };

      const drawDataRow = (cols: Col[], alt: boolean, rowH = ROW_H) => {
        ensureSpace(rowH + 2);
        if (alt) pg.drawRectangle({ x: ML, y: y - (rowH - 8), width: MR - ML, height: rowH, color: C_BG });
        for (const col of cols) {
          const f   = col.isBold ? bold : regular;
          const sz  = col.size ?? 9;
          const clr = col.color ?? C_NAVY;
          if (col.align === 'right') {
            pg.drawText(col.text, { x: col.x - f.widthOfTextAtSize(col.text, sz), y: y - TEXT_OFF, size: sz, font: f, color: clr });
          } else {
            pg.drawText(col.text, { x: col.x, y: y - TEXT_OFF, size: sz, font: f, color: clr });
          }
        }
        y -= rowH;
      };

      const endTable = () => {
        pg.drawLine({ start: { x: ML, y: y + 12 }, end: { x: MR, y: y + 12 }, thickness: 0.4, color: C_BORDER });
        activeHdrCols = null;
      };

      const drawTotalRow = (label: string, value: string, valueX: number, valueColor: any) => {
        endTable();
        pg.drawText(label, { x: ML + 10, y: y + 2, size: 9, font: bold, color: C_NAVY });
        pg.drawText(value, { x: valueX - bold.widthOfTextAtSize(value, 9), y: y + 2, size: 9, font: bold, color: valueColor });
        y -= 20;
      };

      // ── PATRIMÔNIO LÍQUIDO ───────────────────────────────────────────────
      drawSectionTitle('Patrimônio Líquido');

      const CARD_W = 160, CARD_GAP = 9;
      [
        { label: 'Saldo em Contas',  value: fmt(bankBalance),     accent: C_BLUE  },
        { label: 'Investimentos',    value: fmt(investmentValue), accent: C_GREEN },
        { label: 'Patrimônio Total', value: fmt(netWorth),        accent: C_NAVY  },
      ].forEach((card, i) => {
        const cx = ML + i * (CARD_W + CARD_GAP);
        pg.drawRectangle({ x: cx, y: y - 54, width: CARD_W, height: 60, color: C_BG });
        pg.drawRectangle({ x: cx, y: y + 6,  width: CARD_W, height: 3,  color: card.accent });
        pg.drawText(card.label, { x: cx + 10, y: y - 12, size: 8,  font: regular, color: C_GRAY });
        pg.drawText(card.value, { x: cx + 10, y: y - 32, size: 11, font: bold,    color: card.accent });
      });
      y -= 74;

      // ── RESUMO DO MÊS ATUAL ───────────────────────────────────────────────
      if (curMonth.hasData) {
        sectionGap(4);
        const mName = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        drawSectionTitle(`Resumo — ${mName.charAt(0).toUpperCase() + mName.slice(1)}`);

        const saveRate  = curMonth.income > 0 ? (curMonth.balance / curMonth.income) * 100 : 0;
        const isPositive = curMonth.balance >= 0;

        const kpiCards = [
          { label: 'Receitas do Mês',  value: fmt(curMonth.income),   sub: 'entradas confirmadas', accent: C_GREEN },
          { label: 'Despesas do Mês',  value: fmt(curMonth.expenses), sub: 'saídas registradas',   accent: C_RED   },
          { label: isPositive ? 'Economia' : 'Déficit',
            value: fmt(Math.abs(curMonth.balance)),
            sub: curMonth.income > 0 ? `${saveRate.toFixed(1)}% da renda` : '—',
            accent: isPositive ? C_BLUE : C_RED },
        ];

        kpiCards.forEach((card, i) => {
          const cx = ML + i * (CARD_W + CARD_GAP);
          pg.drawRectangle({ x: cx, y: y - 54, width: CARD_W, height: 60, color: C_BG });
          pg.drawRectangle({ x: cx, y: y + 6,  width: CARD_W, height: 3,  color: card.accent });
          pg.drawText(card.label, { x: cx + 10, y: y - 12, size: 8,  font: regular, color: C_GRAY });
          pg.drawText(card.value, { x: cx + 10, y: y - 30, size: 10, font: bold,    color: card.accent });
          pg.drawText(card.sub,   { x: cx + 10, y: y - 44, size: 7,  font: regular, color: C_LGRAY });
        });
        y -= 74;
      }

      // ── CONTAS BANCÁRIAS ─────────────────────────────────────────────────
      if ((accounts ?? []).length > 0) {
        sectionGap(4);
        drawSectionTitle('Contas Bancárias');

        const ATYPE: Record<string, string> = {
          CHECKING: 'Conta Corrente', SAVINGS: 'Poupança',
          INVESTMENT: 'Investimento', CASH: 'Dinheiro', OTHER: 'Outra',
        };

        drawHeaderRow([
          { text: 'Conta', x: ML + 10 },
          { text: 'Tipo',  x: 310 },
          { text: 'Saldo', x: MR, align: 'right' },
        ]);

        (accounts ?? []).forEach((acc, idx) => {
          drawDataRow([
            { text: clip(acc.name, 40), x: ML + 10 },
            { text: ATYPE[acc.type] || acc.type, x: 310, color: C_GRAY },
            { text: fmt(Number(acc.balance)), x: MR, align: 'right', isBold: true, color: Number(acc.balance) >= 0 ? C_GREEN : C_RED },
          ], idx % 2 !== 0);
        });

        drawTotalRow('Total', fmt(bankBalance), MR, bankBalance >= 0 ? C_GREEN : C_RED);
      }

      // ── FLUXO DE CAIXA (sempre 6 meses) ──────────────────────────────────
      sectionGap(4);
      drawSectionTitle('Fluxo de Caixa — Últimos 6 Meses');

      const CF_MES  = ML + 10;
      const CF_REC  = 310;
      const CF_DESP = 430;
      const CF_SAL  = MR;

      drawHeaderRow([
        { text: 'Mês',      x: CF_MES },
        { text: 'Receitas', x: CF_REC,  align: 'right' },
        { text: 'Despesas', x: CF_DESP, align: 'right' },
        { text: 'Saldo',    x: CF_SAL,  align: 'right' },
      ]);

      cashFlow.forEach((row, idx) => {
        if (row.hasData) {
          drawDataRow([
            { text: row.label,         x: CF_MES },
            { text: fmt(row.income),   x: CF_REC,  align: 'right', color: C_GREEN },
            { text: fmt(row.expenses), x: CF_DESP, align: 'right', color: C_RED   },
            { text: fmt(row.balance),  x: CF_SAL,  align: 'right', isBold: true, color: row.balance >= 0 ? C_GREEN : C_RED },
          ], idx % 2 !== 0);
        } else {
          drawDataRow([
            { text: row.label, x: CF_MES, color: C_LGRAY },
            { text: '—', x: CF_REC,  align: 'right', color: C_LGRAY },
            { text: '—', x: CF_DESP, align: 'right', color: C_LGRAY },
            { text: '—', x: CF_SAL,  align: 'right', color: C_LGRAY },
          ], idx % 2 !== 0);
        }
      });

      endTable();
      y -= 6;

      // ── DESPESAS POR CATEGORIA — barra visual ─────────────────────────────
      if (byCategory.length > 0) {
        sectionGap(4);
        const mLabel = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        drawSectionTitle(`Despesas por Categoria — ${mLabel.charAt(0).toUpperCase() + mLabel.slice(1)}`);

        const totalCatExp = byCategory.reduce((s, c) => s + c.total, 0);
        const maxTotal    = byCategory[0]?.total ?? 1;

        // Column positions
        const CAT_NAME_X = ML + 10;          // category name left
        const BAR_X      = 168;              // bar left edge
        const BAR_W      = 210;              // bar total width
        const BAR_H      = 7;               // bar height
        const VAL_X      = 478;             // value right edge
        const PCT_X      = MR;             // percentage right edge
        const CAT_ROW_H  = 24;             // taller row to fit bar below text

        // Header
        ensureSpace(CAT_ROW_H + 4);
        activeHdrCols = null; // bar chart rows — no standard header to redraw
        pg.drawRectangle({ x: ML, y: y - 12, width: MR - ML, height: ROW_H, color: C_NAVY });
        pg.drawText('Categoria', { x: CAT_NAME_X, y: y - TEXT_OFF + 1, size: 8, font: bold, color: C_WHITE });
        pg.drawText('Valor',     { x: VAL_X - bold.widthOfTextAtSize('Valor', 8), y: y - TEXT_OFF + 1, size: 8, font: bold, color: C_WHITE });
        pg.drawText('%',         { x: PCT_X - bold.widthOfTextAtSize('%', 8), y: y - TEXT_OFF + 1, size: 8, font: bold, color: C_WHITE });
        y -= ROW_H + 2;

        byCategory.forEach((cat, idx) => {
          ensureSpace(CAT_ROW_H + 2);
          if (idx % 2 !== 0) pg.drawRectangle({ x: ML, y: y - CAT_ROW_H + 8, width: MR - ML, height: CAT_ROW_H, color: C_BG });

          // Category name
          pg.drawText(clip(cat.name, 16), { x: CAT_NAME_X, y: y - TEXT_OFF, size: 9, font: regular, color: C_NAVY });

          // Bar background (gray track)
          pg.drawRectangle({ x: BAR_X, y: y - 14, width: BAR_W, height: BAR_H, color: C_GLRAY2 });
          // Bar fill (proportional to max category)
          const fillW = BAR_W * (cat.total / maxTotal);
          pg.drawRectangle({ x: BAR_X, y: y - 14, width: fillW, height: BAR_H, color: C_BLUE });

          // Value and percentage
          const pct = pctStr(cat.total, totalCatExp);
          pg.drawText(fmt(cat.total), { x: VAL_X - bold.widthOfTextAtSize(fmt(cat.total), 9), y: y - TEXT_OFF, size: 9, font: bold, color: C_RED });
          pg.drawText(pct,            { x: PCT_X - regular.widthOfTextAtSize(pct, 8), y: y - TEXT_OFF, size: 8, font: regular, color: C_GRAY });

          y -= CAT_ROW_H;
        });

        // Total line
        pg.drawLine({ start: { x: ML, y: y + 14 }, end: { x: MR, y: y + 14 }, thickness: 0.4, color: C_BORDER });
        pg.drawText('Total de Despesas', { x: CAT_NAME_X, y: y + 4, size: 9, font: bold, color: C_NAVY });
        const totStr = fmt(totalCatExp);
        pg.drawText(totStr, { x: VAL_X - bold.widthOfTextAtSize(totStr, 9), y: y + 4, size: 9, font: bold, color: C_RED });
        y -= 20;
      }

      // ── PRÓXIMAS CONTAS ────────────────────────────────────────────────────
      if ((upcomingBills ?? []).length > 0) {
        sectionGap(4);
        drawSectionTitle('Próximas Contas a Pagar — 30 Dias');

        const BILL_DESC = ML + 10;
        const BILL_CAT  = 240;
        const BILL_DUE  = 442;
        const BILL_VAL  = MR;

        drawHeaderRow([
          { text: 'Descrição',  x: BILL_DESC },
          { text: 'Categoria',  x: BILL_CAT },
          { text: 'Vencimento', x: BILL_DUE, align: 'right' },
          { text: 'Valor',      x: BILL_VAL, align: 'right' },
        ]);

        let billsTotal = 0;
        (upcomingBills ?? []).forEach((bill: any, idx) => {
          const amount = Number(bill.amount);
          billsTotal += amount;
          drawDataRow([
            { text: clip(bill.description || 'Lançamento', 25), x: BILL_DESC },
            { text: clip(bill.category?.name || '—', 16),       x: BILL_CAT, color: C_GRAY, size: 8 },
            { text: fmtDate(bill.date), x: BILL_DUE, align: 'right', color: C_AMBER },
            { text: fmt(amount),        x: BILL_VAL, align: 'right', isBold: true, color: C_RED },
          ], idx % 2 !== 0);
        });

        drawTotalRow('Total a pagar', fmt(billsTotal), MR, C_RED);
      }

      // ── Output ────────────────────────────────────────────────────────────
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
