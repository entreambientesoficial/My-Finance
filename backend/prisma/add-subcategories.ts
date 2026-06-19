import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

const defaultSubcategories: Record<string, { type: TransactionType; icon?: string; color?: string; sub: string[] }> = {
  'Alimentação': {
    type: 'EXPENSE',
    sub: ['Supermercado', 'Restaurantes', 'Delivery', 'Lanches & Cafés']
  },
  'Moradia': {
    type: 'EXPENSE',
    sub: ['Aluguel / Financiamento', 'Condomínio', 'Luz & Água', 'Internet & TV', 'Reforma & Decoração']
  },
  'Transporte': {
    type: 'EXPENSE',
    sub: ['Combustível', 'Estacionamento', 'Seguro Auto', 'Manutenção & Peças', 'Pedágio', 'Uber / Táxi / Ônibus']
  },
  'Saúde': {
    type: 'EXPENSE',
    sub: ['Plano de Saúde', 'Farmácia', 'Consultas & Exames', 'Dentista']
  },
  'Lazer': {
    type: 'EXPENSE',
    sub: ['Viagens', 'Cinema / Shows', 'Streaming (Netflix, Spotify...)', 'Assinaturas & Jogos', 'Bares & Festas']
  },
  'Contas e Serviços': {
    type: 'EXPENSE',
    sub: ['Tarifas Bancárias', 'Impostos / Taxas', 'Empréstimos', 'Serviços Diversos']
  },
  'Salário': {
    type: 'INCOME',
    sub: ['Salário Principal', 'Décimo Terceiro / Férias', 'Bônus / PLR']
  },
  'Freelance': {
    type: 'INCOME',
    sub: ['Projetos', 'Consultoria', 'Comissões']
  }
};

async function main() {
  console.log('🔄 Iniciando atualização de subcategorias...');

  // Get all households
  const households = await prisma.household.findMany();
  console.log(`Encontradas ${households.length} famílias.`);

  for (const h of households) {
    console.log(`Processando Família: ${h.name} (${h.id})`);

    // Get existing categories for this household
    const existingCategories = await prisma.category.findMany({
      where: { householdId: h.id, parentId: null }
    });

    for (const [parentName, subInfo] of Object.entries(defaultSubcategories)) {
      // Find parent category by name or type
      let parent = existingCategories.find(c => c.name.toLowerCase() === parentName.toLowerCase() && c.type === subInfo.type);

      // If parent is "Transporte", rename to "Veículo & Transporte" as proposed
      if (parentName === 'Transporte' && parent) {
        parent = await prisma.category.update({
          where: { id: parent.id },
          data: { name: 'Veículo & Transporte' }
        });
        console.log(`  Renomeada categoria 'Transporte' para 'Veículo & Transporte'`);
      }

      // If parent category doesn't exist, create it
      if (!parent) {
        const icon = subInfo.type === 'INCOME' ? 'payments' : 'shopping_bag';
        const color = subInfo.type === 'INCOME' ? '#10b981' : '#64748b';
        const nameToUse = parentName === 'Transporte' ? 'Veículo & Transporte' : parentName;
        
        parent = await prisma.category.create({
          data: {
            householdId: h.id,
            name: nameToUse,
            type: subInfo.type,
            icon,
            color,
            isDefault: true
          }
        });
        console.log(`  Criada categoria pai '${nameToUse}'`);
      }

      // Check and add subcategories
      const existingChildren = await prisma.category.findMany({
        where: { householdId: h.id, parentId: parent.id }
      });

      for (const subName of subInfo.sub) {
        const hasChild = existingChildren.some(c => c.name.toLowerCase() === subName.toLowerCase());
        if (!hasChild) {
          await prisma.category.create({
            data: {
              householdId: h.id,
              name: subName,
              type: subInfo.type,
              parentId: parent.id,
              icon: parent.icon,
              color: parent.color,
              isDefault: true
            }
          });
          console.log(`    Criada subcategoria: '${subName}' de '${parent.name}'`);
        }
      }
    }
  }

  console.log('✅ Atualização de subcategorias concluída com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro ao adicionar subcategorias:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
