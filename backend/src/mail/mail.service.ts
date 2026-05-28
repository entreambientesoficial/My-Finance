import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail(options: { to: string; subject: string; html: string }) {
    if (!process.env.SMTP_USER) {
      this.logger.warn(`[Mail] SMTP não configurado — e-mail para ${options.to} suprimido`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || `"MY-FINANCE" <${process.env.SMTP_USER}>`,
        ...options,
      });
      this.logger.log(`E-mail enviado para ${options.to}: ${options.subject}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail para ${options.to}`, err?.message);
    }
  }

  async sendUpcomingBillAlert(user: { name: string; email: string }, bills: any[]) {
    const rows = bills.map((b) =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${b.description || 'Lançamento'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${new Date(b.date).toLocaleDateString('pt-BR')}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#ef4444;font-weight:600">R$ ${Number(b.amount).toFixed(2)}</td>
      </tr>`,
    ).join('');

    await this.sendMail({
      to: user.email,
      subject: `MY-FINANCE — Você tem ${bills.length} conta(s) a pagar nos próximos 3 dias`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#031632">Olá, ${user.name}!</h2>
          <p style="color:#64748b">As seguintes despesas vencem nos próximos 3 dias:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead>
              <tr style="background:#f7f9fb">
                <th style="text-align:left;padding:8px 12px;font-size:12px;color:#64748b;text-transform:uppercase">Descrição</th>
                <th style="text-align:left;padding:8px 12px;font-size:12px;color:#64748b;text-transform:uppercase">Vencimento</th>
                <th style="text-align:left;padding:8px 12px;font-size:12px;color:#64748b;text-transform:uppercase">Valor</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <a href="${process.env.FRONTEND_URL}/transactions" style="display:inline-block;background:#031632;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">Ver Transações</a>
        </div>`,
    });
  }

  async sendBudgetAlert(user: { name: string; email: string }, budget: any) {
    await this.sendMail({
      to: user.email,
      subject: `MY-FINANCE — Orçamento "${budget.name}" atingiu ${budget.percentage}%`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#031632">Atenção, ${user.name}!</h2>
          <p style="color:#64748b">O orçamento <strong>${budget.name}</strong> está em <strong style="color:#f59e0b">${budget.percentage}%</strong>.</p>
          <p style="color:#64748b">Gasto: <strong>R$ ${Number(budget.spent).toFixed(2)}</strong> de <strong>R$ ${Number(budget.amount).toFixed(2)}</strong></p>
          <a href="${process.env.FRONTEND_URL}/budgets" style="display:inline-block;background:#031632;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">Ver Orçamentos</a>
        </div>`,
    });
  }

  async sendGoalCompletedAlert(user: { name: string; email: string }, goal: any) {
    await this.sendMail({
      to: user.email,
      subject: `MY-FINANCE — Meta "${goal.name}" concluída! 🎉`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#006c49">Parabéns, ${user.name}!</h2>
          <p style="color:#64748b">Você concluiu a meta <strong>${goal.name}</strong> de <strong>R$ ${Number(goal.targetAmount).toFixed(2)}</strong>!</p>
          <a href="${process.env.FRONTEND_URL}/goals" style="display:inline-block;background:#006c49;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px">Ver Metas</a>
        </div>`,
    });
  }

  async sendInvite(email: string, inviterName: string, householdName: string, inviteLink: string) {
    await this.sendMail({
      to: email,
      subject: `${inviterName} convidou você para o MY-FINANCE`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#031632">Você foi convidado!</h2>
          <p style="color:#64748b"><strong>${inviterName}</strong> convidou você para participar da família <strong>${householdName}</strong> no MY-FINANCE.</p>
          <a href="${inviteLink}" style="display:inline-block;background:#031632;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-top:8px">Aceitar convite</a>
          <p style="color:#94a3b8;font-size:12px;margin-top:16px">Este link expira em 48 horas.</p>
        </div>`,
    });
  }
}
