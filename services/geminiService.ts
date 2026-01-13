
import { GoogleGenAI } from "@google/genai";
import { DailyCloseRecord, StaffMember } from '../types';

// Helper para formatação de moeda
const formatCurrency = (value: number) => `R$ ${value.toFixed(2)}`;

// Função de Fallback para gerar resumo sem IA
const generateStaticSummary = (record: DailyCloseRecord, staffList: StaffMember[]): string => {
  const sales = record.sales;
  const ifood = sales.ifood || 0;
  const kcms = sales.kcms || (sales as any).app2 || 0;
  const sgv = sales.sgv || (sales as any).app3 || 0;
  const totalSales = ifood + kcms + sgv;

  const totalStaffPayments = record.payments.reduce((acc, curr) => acc + curr.amount, 0);
  const totalDebts = record.debts ? record.debts.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  const totalPending = record.pendingPayables ? record.pendingPayables.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  
  const ifoodMotoboyCost = record.ifoodMotoboys?.totalCost || 0;
  const finalBalance = totalSales;

  const attendantName = record.closedByStaffId 
    ? staffList.find(s => s.id === record.closedByStaffId)?.name || 'Não identificado'
    : 'Não informado';

  const formattedDate = record.date.split('-').reverse().join('/');

  let text = `📊 *FECHAMENTO DE CAIXA - ${formattedDate}*\n`;
  text += `👤 *RESPONSÁVEL:* ${attendantName}\n\n`;

  text += `💰 *VENDAS TOTAIS: ${formatCurrency(totalSales)}*\n`;
  text += `🔸 iFood: ${formatCurrency(ifood)}\n`;
  text += `🔸 KCMS: ${formatCurrency(kcms)}\n`;
  text += `🔸 SGV: ${formatCurrency(sgv)}\n\n`;

  // Seção de Pagamentos Pagos
  const paidStaff = record.payments.filter(p => p.isPaid);
  if (paidStaff.length > 0) {
    text += `✅ *PAGAMENTOS REALIZADOS (PAGOS):*\n`;
    paidStaff.forEach(p => {
      const staff = staffList.find(s => s.id === p.staffId);
      text += `▪️ ${staff?.name || 'Desconhecido'}: ${formatCurrency(p.amount)}\n`;
    });
    text += `\n`;
  }

  // Seção de Pagamentos Pendentes
  const pendingStaff = record.payments.filter(p => !p.isPaid);
  if (pendingStaff.length > 0) {
    text += `⏳ *PAGAMENTOS PENDENTES (A PAGAR):*\n`;
    pendingStaff.forEach(p => {
      const staff = staffList.find(s => s.id === p.staffId);
      const pix = staff?.pixKey ? ` (Pix: ${staff.pixKey})` : '';
      text += `▪️ ${staff?.name || 'Desconhecido'}${pix}: ${formatCurrency(p.amount)}\n`;
    });
    text += `\n`;
  }

  if (totalPending > 0) {
    text += `⚠️ *OUTRAS PENDÊNCIAS/FORNECEDORES: ${formatCurrency(totalPending)}*\n`;
    record.pendingPayables?.forEach(p => {
        text += `▪️ ${p.name}: ${formatCurrency(p.amount)}\n`;
    });
    text += `\n`;
  }

  if (totalDebts > 0) {
    text += `📒 *FIADO (A RECEBER): ${formatCurrency(totalDebts)}*\n`;
    record.debts?.forEach(d => {
      text += `▪️ ${d.name}: ${formatCurrency(d.amount)}\n`;
    });
    text += `\n`;
  }

  text += `✅ *SALDO FINAL EM CAIXA: ${formatCurrency(finalBalance)}*`;
  
  if (record.notes) {
    text += `\n\n📝 *OBS:* ${record.notes}`;
  }

  return text;
};

export const generateFinancialSummary = async (
  record: DailyCloseRecord,
  staffList: StaffMember[]
): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return generateStaticSummary(record, staffList);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const paidStaffDetails = record.payments
      .filter(p => p.isPaid)
      .map(p => {
        const staff = staffList.find(s => s.id === p.staffId);
        return `- ${staff?.name || 'Desconhecido'}: R$ ${p.amount.toFixed(2)}`;
      }).join('\n');

    const pendingStaffDetails = record.payments
      .filter(p => !p.isPaid)
      .map(p => {
        const staff = staffList.find(s => s.id === p.staffId);
        const pixStr = staff?.pixKey ? ` | Pix: ${staff.pixKey}` : ''; 
        return `- ${staff?.name || 'Desconhecido'}${pixStr}: R$ ${p.amount.toFixed(2)}`;
      }).join('\n');

    const sales = record.sales;
    const totalSales = (sales.ifood || 0) + (sales.kcms || 0) + (sales.sgv || 0);

    const attendantName = record.closedByStaffId 
      ? staffList.find(s => s.id === record.closedByStaffId)?.name || 'Não identificado'
      : 'Não informado';

    const systemInstruction = `Você é o assistente financeiro do 'Big Borda Gourmet'. 
    Sua missão é gerar um resumo impecável para WhatsApp. 
    REGRAS OBRIGATÓRIAS DE FORMATAÇÃO:
    1. Divida os funcionários em duas seções claras: "✅ PAGAMENTOS REALIZADOS (PAGOS)" e "⏳ PAGAMENTOS PENDENTES (A PAGAR)".
    2. Liste o faturamento detalhado (iFood, KCMS, SGV) no topo.
    3. Use negrito nos títulos e valores.
    4. O Saldo Final deve ser o total bruto das vendas.
    5. Não invente informações. Se uma seção estiver vazia, apenas não a mostre ou diga "Nenhum".`;

    const contentPrompt = `
      Gere o resumo de fechamento com estas informações:
      DATA: ${record.date.split('-').reverse().join('/')}
      RESPONSÁVEL: ${attendantName}
      
      VENDAS:
      - iFood: R$ ${sales.ifood.toFixed(2)}
      - KCMS: R$ ${sales.kcms.toFixed(2)}
      - SGV: R$ ${sales.sgv.toFixed(2)}
      TOTAL: R$ ${totalSales.toFixed(2)}
      
      FUNCIONÁRIOS QUE JÁ FORAM PAGOS HOJE:
      ${paidStaffDetails || 'Nenhum'}

      FUNCIONÁRIOS COM PAGAMENTO PENDENTE (A PAGAR):
      ${pendingStaffDetails || 'Nenhum'}

      OUTRAS PENDÊNCIAS (DÍVIDAS/FORNECEDORES):
      ${record.pendingPayables?.map(p => `- ${p.name}: R$ ${p.amount.toFixed(2)}`).join('\n') || 'Nenhuma'}

      FIADO (A RECEBER):
      ${record.debts?.map(d => `- ${d.name}: R$ ${d.amount.toFixed(2)}`).join('\n') || 'Nenhum'}

      SALDO FINAL: R$ ${totalSales.toFixed(2)}
      OBSERVAÇÕES: ${record.notes || 'Nenhuma'}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contentPrompt,
      config: { systemInstruction }
    });

    return response.text || generateStaticSummary(record, staffList);

  } catch (error) {
    console.error("Erro na IA:", error);
    return generateStaticSummary(record, staffList);
  }
};
