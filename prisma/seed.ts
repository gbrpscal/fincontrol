import { PrismaClient, type CategoriaTipo } from "@prisma/client";

// Seed idempotente do plano de contas padrão (CategoriaTemplate — global, sem
// empresaId). Copiado para `Categoria` de cada empresa no momento do
// registro (ver AuthService.registrar). Decisão confirmada: template +
// customização, não "do zero".
const prisma = new PrismaClient();

interface TemplateNode {
  nome: string;
  tipo: CategoriaTipo;
  filhas?: TemplateNode[];
}

const PLANO_PADRAO: TemplateNode[] = [
  {
    nome: "Receitas",
    tipo: "RECEITA",
    filhas: [
      { nome: "Vendas de Produtos", tipo: "RECEITA" },
      { nome: "Vendas de Serviços", tipo: "RECEITA" },
      { nome: "Outras Receitas", tipo: "RECEITA" },
    ],
  },
  {
    nome: "Custos",
    tipo: "CUSTO",
    filhas: [
      { nome: "Custo de Mercadoria Vendida", tipo: "CUSTO" },
      { nome: "Matéria-Prima", tipo: "CUSTO" },
      { nome: "Mão de Obra Direta", tipo: "CUSTO" },
    ],
  },
  {
    nome: "Despesas Administrativas",
    tipo: "DESPESA",
    filhas: [
      { nome: "Aluguel", tipo: "DESPESA" },
      { nome: "Água, Luz e Internet", tipo: "DESPESA" },
      { nome: "Material de Escritório", tipo: "DESPESA" },
    ],
  },
  {
    nome: "Despesas com Pessoal",
    tipo: "DESPESA",
    filhas: [
      { nome: "Salários", tipo: "DESPESA" },
      { nome: "Encargos Trabalhistas", tipo: "DESPESA" },
      { nome: "Benefícios", tipo: "DESPESA" },
    ],
  },
  {
    nome: "Despesas Comerciais",
    tipo: "DESPESA",
    filhas: [
      { nome: "Marketing e Publicidade", tipo: "DESPESA" },
      { nome: "Comissões", tipo: "DESPESA" },
    ],
  },
  {
    nome: "Despesas Financeiras",
    tipo: "DESPESA",
    filhas: [
      { nome: "Tarifas Bancárias", tipo: "DESPESA" },
      { nome: "Juros e Multas Pagas", tipo: "DESPESA" },
    ],
  },
  {
    nome: "Despesas Operacionais",
    tipo: "DESPESA",
    filhas: [
      { nome: "Manutenção", tipo: "DESPESA" },
      { nome: "Insumos e Suprimentos", tipo: "DESPESA" },
    ],
  },
];

async function criarNo(node: TemplateNode, parentTemplateId: string | null): Promise<void> {
  const existente = await prisma.categoriaTemplate.findFirst({
    where: { nome: node.nome, parentTemplateId },
  });

  const registro =
    existente ??
    (await prisma.categoriaTemplate.create({
      data: { nome: node.nome, tipo: node.tipo, parentTemplateId },
    }));

  for (const filha of node.filhas ?? []) {
    await criarNo(filha, registro.id);
  }
}

async function main() {
  for (const raiz of PLANO_PADRAO) {
    await criarNo(raiz, null);
  }
  const total = await prisma.categoriaTemplate.count();
  console.log(`Plano de contas padrão: ${total} categorias no template global.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
