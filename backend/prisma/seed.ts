import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpa dados existentes (só em dev)
  await prisma.refreshToken.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.card.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.household.deleteMany();

  // Household
  const household = await prisma.household.create({
    data: { name: 'Família Demo', currency: 'BRL' },
  });

  // Usuário demo
  await prisma.user.create({
    data: {
      name: 'Anderson Demo',
      email: 'demo@myfinance.com',
      passwordHash: await bcrypt.hash('demo123', 10),
      householdId: household.id,
    },
  });

  // Categorias padrão
  const categories = await prisma.category.createManyAndReturn({
    data: [
      { householdId: household.id, name: 'Alimentação', type: 'EXPENSE', icon: 'restaurant', color: '#f59e0b', isDefault: true },
      { householdId: household.id, name: 'Moradia', type: 'EXPENSE', icon: 'home', color: '#3b82f6', isDefault: true },
      { householdId: household.id, name: 'Transporte', type: 'EXPENSE', icon: 'directions_car', color: '#8b5cf6', isDefault: true },
      { householdId: household.id, name: 'Saúde', type: 'EXPENSE', icon: 'health_and_safety', color: '#ef4444', isDefault: true },
      { householdId: household.id, name: 'Lazer', type: 'EXPENSE', icon: 'sports_esports', color: '#ec4899', isDefault: true },
      { householdId: household.id, name: 'Contas e Serviços', type: 'EXPENSE', icon: 'receipt', color: '#64748b', isDefault: true },
      { householdId: household.id, name: 'Salário', type: 'INCOME', icon: 'payments', color: '#10b981', isDefault: true },
      { householdId: household.id, name: 'Freelance', type: 'INCOME', icon: 'work', color: '#059669', isDefault: true },
    ],
  });

  const catMap = Object.fromEntries(categories.map((c) => [c.name, c]));

  // Contas bancárias
  const checking = await prisma.account.create({
    data: { householdId: household.id, name: 'Conta Corrente', type: 'CHECKING', bank: 'Itaú', balance: 5230.50, color: '#FF6B00' },
  });
  const savings = await prisma.account.create({
    data: { householdId: household.id, name: 'Poupança', type: 'SAVINGS', bank: 'Caixa', balance: 12400.00, color: '#0078A8' },
  });
  const investAcc = await prisma.account.create({
    data: { householdId: household.id, name: 'Corretora', type: 'INVESTMENT', bank: 'XP', balance: 32750.00, color: '#FF6B00' },
  });

  // Cartão
  const card = await prisma.card.create({
    data: {
      householdId: household.id,
      accountId: checking.id,
      name: 'Nubank',
      brand: 'MASTERCARD',
      lastFourDigits: '4521',
      creditLimit: 8000,
      billingDay: 1,
      dueDay: 10,
      color: '#8b5cf6',
    },
  });

  // Transações do mês atual
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const transactions = [
    { type: 'INCOME', amount: 8500, description: 'Salário', date: new Date(y, m, 5), accountId: checking.id, categoryId: catMap['Salário'].id },
    { type: 'INCOME', amount: 1200, description: 'Freelance web', date: new Date(y, m, 12), accountId: checking.id, categoryId: catMap['Freelance'].id },
    { type: 'EXPENSE', amount: 2200, description: 'Aluguel', date: new Date(y, m, 10), accountId: checking.id, categoryId: catMap['Moradia'].id },
    { type: 'EXPENSE', amount: 480, description: 'Supermercado', date: new Date(y, m, 8), accountId: checking.id, categoryId: catMap['Alimentação'].id },
    { type: 'EXPENSE', amount: 95, description: 'Uber', date: new Date(y, m, 15), cardId: card.id, categoryId: catMap['Transporte'].id },
    { type: 'EXPENSE', amount: 320, description: 'Academia + Plano de Saúde', date: new Date(y, m, 5), cardId: card.id, categoryId: catMap['Saúde'].id },
    { type: 'EXPENSE', amount: 180, description: 'Netflix + Spotify + outros', date: new Date(y, m, 1), cardId: card.id, categoryId: catMap['Contas e Serviços'].id },
    { type: 'EXPENSE', amount: 250, description: 'Restaurantes', date: new Date(y, m, 18), cardId: card.id, categoryId: catMap['Lazer'].id },
  ];

  for (const t of transactions) {
    await prisma.transaction.create({ data: { ...t, householdId: household.id, isPaid: true } as any });
  }

  // Orçamentos
  await prisma.budget.createMany({
    data: [
      { householdId: household.id, name: 'Alimentação', amount: 600, period: 'MONTHLY', categoryId: catMap['Alimentação'].id, month: m + 1, year: y },
      { householdId: household.id, name: 'Transporte', amount: 300, period: 'MONTHLY', categoryId: catMap['Transporte'].id, month: m + 1, year: y },
      { householdId: household.id, name: 'Lazer', amount: 400, period: 'MONTHLY', categoryId: catMap['Lazer'].id, month: m + 1, year: y },
      { householdId: household.id, name: 'Saúde', amount: 400, period: 'MONTHLY', categoryId: catMap['Saúde'].id, month: m + 1, year: y },
    ],
  });

  // Metas
  await prisma.goal.createMany({
    data: [
      { householdId: household.id, name: 'Reserva de Emergência', targetAmount: 30000, currentAmount: 12400, icon: 'savings', color: '#10b981' },
      { householdId: household.id, name: 'Viagem para Europa', targetAmount: 20000, currentAmount: 3500, targetDate: new Date(2027, 5, 1), icon: 'flight', color: '#3b82f6' },
      { householdId: household.id, name: 'Entrada Apartamento', targetAmount: 80000, currentAmount: 15000, icon: 'home', color: '#f59e0b' },
    ],
  });

  // Investimentos
  await prisma.investment.createMany({
    data: [
      { householdId: household.id, name: 'Itaúsa', type: 'STOCK', ticker: 'ITSA4', quantity: 500, purchasePrice: 9.80, currentPrice: 11.20, broker: 'XP', purchaseDate: new Date(2024, 2, 15) },
      { householdId: household.id, name: 'Tesouro IPCA+ 2029', type: 'BOND', quantity: 2, purchasePrice: 4200, currentPrice: 4480, broker: 'XP', purchaseDate: new Date(2024, 6, 1) },
      { householdId: household.id, name: 'XPML11', type: 'FUND', ticker: 'XPML11', quantity: 100, purchasePrice: 98.50, currentPrice: 102.30, broker: 'XP', purchaseDate: new Date(2024, 9, 10) },
    ],
  });

  console.log('✅ Seed concluído!');
  console.log('📧 Login: demo@myfinance.com | Senha: demo123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
