
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
  
  // iFood Motoboys Data
  const ifoodMotoboyCount = record.ifoodMotoboys?.count || 0;
  const ifoodMotoboyCost = record.ifoodMotoboys?.totalCost || 0;

  // Saldo Final agora é o total das vendas (sem subtrair motoboys ifood conforme solicitado)
  const finalBalance = totalSales;

  const attendantName = record.closedByStaffId 
    ? staffList.find(s => s.id === record.closedByStaffId)?.name || 'Não identificado'
    : 'Não informado';

  const formattedDate = record.date.split('-').reverse().join('/');

  let text = `📊 *Fechamento de Caixa - ${formattedDate}*\n`;
  text += `👤 *Responsável:* ${attendantName}\n\n`;

  text += `💰 *VENDAS TOTAIS: ${formatCurrency(totalSales)}*\n`;
  text += `🔸 *iFood:* ${formatCurrency(ifood)}\n`;
  text += `🔸 *KCMS:* ${formatCurrency(kcms)}\n`;
  text += `🔸 *SGV:* ${formatCurrency(sgv)}\n\n`;

  if (ifoodMotoboyCost > 0) {
      text += `🏍️ *MOTOBOTY IFOOD (INFO): ${formatCurrency(ifoodMotoboyCost)}*\n`;
      text += `▪️ ${ifoodMotoboyCount} entregas realizadas.\n\n`;
  }

  text += `⏳ *VALORES A PAGAR (EQUIPE): ${formatCurrency(totalStaffPayments)}*\n`;
  if (record.payments.length > 0) {
    record.payments.forEach(p => {
      const staff = staffList.find(s => s.id === p.staffId);
      const pix = staff?.pixKey ? ` (Pix: ${staff.pixKey})` : '';
      const deliveryInfo = p.deliveryCount ? ` [${p.deliveryCount} entregas]` : '';
      text += `▪️ ${staff?.name || 'Desconhecido'}${deliveryInfo}${pix}: ${formatCurrency(p.amount)}\n`;
    });
  } else {
    text += `▪️ Nenhum valor de equipe lançado.\n`;
  }
  text += `\n`;

  if (totalPending > 0) {
    text += `⚠️ *PENDÊNCIAS (A PAGAR): ${formatCurrency(totalPending)}*\n`;
    record.pendingPayables?.forEach(p => {
        const dateStr = p.date ? ` [Ref: ${p.date.split('-').reverse().join('/')}]` : '';
        text += `▪️ ${p.name}${dateStr}: ${formatCurrency(p.amount)}\n`;
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

  text += `✅ *SALDO FINAL EM CAIXA: ${formatCurrency(finalBalance)}*\n`;
  text += `_(Total bruto das vendas do dia)_\n\n`;
  
  if (record.notes) {
    text += `📝 *Observações:* ${record.notes}`;
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
    
    let staffPaymentsDetails = record.payments.map(p => {
      const staff = staffList.find(s => s.id === p.staffId);
      const pixStr = staff?.pixKey ? ` | Pix: ${staff.pixKey}` : ''; 
      const deliveryInfo = p.deliveryCount ? ` | ${p.deliveryCount} entregas` : '';
      return `- ${staff?.name || 'Desconhecido'}${deliveryInfo}${pixStr}: R$ ${p.amount.toFixed(2)}`;
    }).join('\n');

    const ifoodMotoboyCount = record.ifoodMotoboys?.count || 0;
    const ifoodMotoboyCost = record.ifoodMotoboys?.totalCost || 0;

    const sales = record.sales;
    const ifood = sales.ifood || 0;
    const kcms = sales.kcms || 0;
    const sgv = sales.sgv || 0;
    const totalSales = ifood + kcms + sgv;
    const totalStaffPayments = record.payments.reduce((acc, curr) => acc + curr.amount, 0);
    const finalBalance = totalSales; 

    const attendantName = record.closedByStaffId 
      ? staffList.find(s => s.id === record.closedByStaffId)?.name || 'Não identificado'
      : 'Não informado';

    const systemInstruction = "Você é um assistente financeiro do 'Big Borda Gourmet'. Gere resumos para WhatsApp claros e profissionais. Você DEVE obrigatoriamente mostrar o faturamento detalhado por aplicativo (iFood, KCMS e SGV). Use 'PENDÊNCIAS' para o que o restaurante deve pagar (equipe/fornecedores de outros dias) e 'FIADO' para o que tem a receber de clientes. Regra importante: O saldo final deve ser exatamente o total das vendas brutas.";

    const contentPrompt = `
      Gere um relatório de fechamento detalhando os aplicativos:
      DATA: ${record.date.split('-').reverse().join('/')}
      RESPONSÁVEL: ${attendantName}
      
      DETALHAMENTO DE VENDAS:
      - iFood: R$ ${ifood.toFixed(2)}
      - KCMS: R$ ${kcms.toFixed(2)}
      - SGV: R$ ${sgv.toFixed(2)}
      TOTAL VENDAS: R$ ${totalSales.toFixed(2)}
      
      INFORMAÇÕES DE MOTOBOYS IFOOD:
      - Corridas (${ifoodMotoboyCount} entregas): R$ ${ifoodMotoboyCost.toFixed(2)}

      VALORES A PAGAR (EQUIPE HOJE):
      ${staffPaymentsDetails}
      Total Equipe: R$ ${totalStaffPayments.toFixed(2)}

      PENDÊNCIAS (DÍVIDAS DE OUTROS DIAS/FORNECEDORES):
      ${record.pendingPayables?.map(p => `- ${p.name} (Ref: ${p.date}): R$ ${p.amount.toFixed(2)}`).join('\n') || 'Nenhuma'}

      FIADO (A RECEBER):
      ${record.debts?.map(d => `- ${d.name}: R$ ${d.amount.toFixed(2)}`).join('\n') || 'Nenhum'}

      SALDO FINAL EM CAIXA: R$ ${finalBalance.toFixed(2)}
      
      OBSERVAÇÕES: ${record.notes || 'Nenhuma'}
      
      Formate com emojis e certifique-se de listar as vendas de iFood, KCMS e SGV separadamente no texto.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contentPrompt,
      config: { systemInstruction }
    });

    return response.text || generateStaticSummary(record, staffList);

  } catch (error) {
    return generateStaticSummary(record, staffList);
  }
};
