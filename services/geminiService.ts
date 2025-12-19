import { GoogleGenAI } from "@google/genai";
import { DailyCloseRecord, StaffMember } from '../types';

// Helper para formatação de moeda
const formatCurrency = (value: number) => `R$ ${value.toFixed(2)}`;

// Função de Fallback para gerar resumo sem IA (quando a API falhar ou chave não existir)
const generateStaticSummary = (record: DailyCloseRecord, staffList: StaffMember[]): string => {
  const sales = record.sales;
  const ifood = sales.ifood || 0;
  const kcms = sales.kcms || (sales as any).app2 || 0;
  const sgv = sales.sgv || (sales as any).app3 || 0;
  const totalSales = ifood + kcms + sgv;

  const totalPayments = record.payments.reduce((acc, curr) => acc + curr.amount, 0);
  const totalDebts = record.debts ? record.debts.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  const totalPending = record.pendingPayables ? record.pendingPayables.reduce((acc, curr) => acc + curr.amount, 0) : 0;
  
  // iFood Motoboys Data
  const ifoodMotoboyCount = record.ifoodMotoboys?.count || 0;
  const ifoodMotoboyCost = record.ifoodMotoboys?.totalCost || 0;

  // Saldo Final (Vendas - Pagamentos Equipe - Pagamentos Motoboy iFood)
  const finalBalance = totalSales - totalPayments - ifoodMotoboyCost;

  const attendantName = record.closedByStaffId 
    ? staffList.find(s => s.id === record.closedByStaffId)?.name || 'Não identificado'
    : 'Não informado';

  const formattedDate = record.date.split('-').reverse().join('/');

  // Construção do texto formatado para WhatsApp
  let text = `📊 *Fechamento de Caixa - ${formattedDate}*\n`;
  text += `👤 *Responsável:* ${attendantName}\n\n`;

  text += `💰 *VENDAS TOTAIS: ${formatCurrency(totalSales)}*\n`;
  text += `🔹 iFood: ${formatCurrency(ifood)}\n`;
  text += `🔹 KCMS: ${formatCurrency(kcms)}\n`;
  text += `🔹 SGV: ${formatCurrency(sgv)}\n\n`;

  text += `💸 *SAÍDAS (PAGAMENTOS): ${formatCurrency(totalPayments + ifoodMotoboyCost)}*\n`;
  
  // Lista de pagamentos de equipe
  if (record.payments.length > 0) {
    record.payments.forEach(p => {
      const staff = staffList.find(s => s.id === p.staffId);
      const pix = staff?.pixKey ? ` (Pix: ${staff.pixKey})` : '';
      const deliveryInfo = p.deliveryCount ? ` [${p.deliveryCount} entregas]` : '';
      text += `▪️ ${staff?.name || 'Desconhecido'}${deliveryInfo}${pix}: ${formatCurrency(p.amount)}\n`;
    });
  }
  
  // Item de Motoboy iFood na lista de saídas
  if (ifoodMotoboyCount > 0) {
      text += `▪️ Motoboys iFood (${ifoodMotoboyCount} entregas): ${formatCurrency(ifoodMotoboyCost)}\n`;
  }
  
  if (record.payments.length === 0 && ifoodMotoboyCount === 0) {
    text += `▪️ Nenhum pagamento.\n`;
  }
  text += `\n`;

  if (totalPending > 0) {
    text += `⚠️ *PENDÊNCIAS A PAGAR: ${formatCurrency(totalPending)}*\n`;
    record.pendingPayables?.forEach(p => {
        const dateStr = p.date ? ` [${p.date.split('-').reverse().join('/')}]` : '';
        text += `▪️ ${p.name}${dateStr}: ${formatCurrency(p.amount)}\n`;
    });
    text += `\n`;
  }

  if (totalDebts > 0) {
    text += `📒 *FIADO / A RECEBER: ${formatCurrency(totalDebts)}*\n`;
    record.debts?.forEach(d => {
      text += `▪️ ${d.name}: ${formatCurrency(d.amount)}\n`;
    });
    text += `\n`;
  }

  text += `✅ *SALDO FINAL: ${formatCurrency(finalBalance)}*\n\n`;
  
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
    
    // Se não houver chave configurada, usa o fallback imediatamente
    if (!apiKey) {
      console.warn("API Key não encontrada. Gerando resumo estático.");
      return generateStaticSummary(record, staffList);
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Preparação dos dados para o prompt
    let paymentsDetails = record.payments.map(p => {
      const staff = staffList.find(s => s.id === p.staffId);
      const pixStr = staff?.pixKey ? ` | Pix: ${staff.pixKey}` : ''; 
      const deliveryInfo = p.deliveryCount ? ` | ${p.deliveryCount} entregas` : '';
      return `- ${staff?.name || 'Desconhecido'} (${staff?.role})${deliveryInfo}${pixStr}: R$ ${p.amount.toFixed(2)}`;
    }).join('\n');

    const ifoodMotoboyCount = record.ifoodMotoboys?.count || 0;
    const ifoodMotoboyCost = record.ifoodMotoboys?.totalCost || 0;

    if (ifoodMotoboyCount > 0) {
        paymentsDetails += `\n- Motoboys iFood (${ifoodMotoboyCount} entregas): R$ ${ifoodMotoboyCost.toFixed(2)}`;
    }

    const debtsDetails = record.debts && record.debts.length > 0 
      ? record.debts.map(d => `- ${d.name}: R$ ${d.amount.toFixed(2)}`).join('\n')
      : 'Nenhum fiado.';

    const pendingDetails = record.pendingPayables && record.pendingPayables.length > 0
      ? record.pendingPayables.map(p => {
          const dateStr = p.date ? ` (Data: ${p.date.split('-').reverse().join('/')})` : '';
          return `- ${p.name}${dateStr}: R$ ${p.amount.toFixed(2)}`;
        }).join('\n')
      : 'Nenhuma pendência.';

    const sales = record.sales;
    const ifood = sales.ifood || 0;
    const kcms = sales.kcms || (sales as any).app2 || 0;
    const sgv = sales.sgv || (sales as any).app3 || 0;

    const totalSales = ifood + kcms + sgv;
    const totalPayments = record.payments.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaymentsAndExpenses = totalPayments + ifoodMotoboyCost;

    const totalDebts = record.debts ? record.debts.reduce((acc, curr) => acc + curr.amount, 0) : 0;
    const totalPending = record.pendingPayables ? record.pendingPayables.reduce((acc, curr) => acc + curr.amount, 0) : 0;
    
    const finalBalance = totalSales - totalPaymentsAndExpenses;

    const attendantName = record.closedByStaffId 
      ? staffList.find(s => s.id === record.closedByStaffId)?.name || 'Não identificado'
      : 'Não informado';

    const formattedDate = record.date.split('-').reverse().join('/');

    const systemInstruction = "Você é um assistente financeiro experiente do restaurante 'Big Borda Gourmet'. Sua função é gerar resumos financeiros claros, profissionais e diretos para envio via WhatsApp. Utilize emojis moderadamente para organizar a leitura.";

    const contentPrompt = `
      Gere um relatório de fechamento de caixa com os seguintes dados:

      DATA: ${formattedDate}
      RESPONSÁVEL PELO FECHAMENTO: ${attendantName}
      
      == VENDAS (ENTRADAS) ==
      Total: R$ ${totalSales.toFixed(2)}
      Detalhamento: iFood: R$ ${ifood.toFixed(2)} | KCMS: R$ ${kcms.toFixed(2)} | SGV: R$ ${sgv.toFixed(2)}
      
      == PAGAMENTOS REALIZADOS (SAÍDAS) ==
      Total (Equipe + iFood Boys): R$ ${totalPaymentsAndExpenses.toFixed(2)}
      Lista:
      ${paymentsDetails}

      == PENDÊNCIAS A PAGAR (DÍVIDAS DO RESTAURANTE) ==
      Total: R$ ${totalPending.toFixed(2)}
      Lista:
      ${pendingDetails}

      == FIADO / A RECEBER (CLIENTES) ==
      Total: R$ ${totalDebts.toFixed(2)}
      Lista:
      ${debtsDetails}

      == SALDO FINAL DO DIA (Vendas - Pagamentos) ==
      R$ ${finalBalance.toFixed(2)}
      
      OBSERVAÇÕES: ${record.notes || 'Nenhuma'}
      
      Instruções para o formato da resposta:
      1. Inicie com um título chamativo (ex: 📊 Fechamento de Caixa).
      2. Destaque o RESPONSÁVEL e o SALDO FINAL.
      3. Liste os pagamentos mantendo as chaves PIX visíveis para facilitar a transferência.
      4. Indique a quantidade de entregas (quando disponível) ao lado dos nomes dos motoboys.
      5. Indique claramente que 'Pendências' e 'Fiado' são apenas informativos e não alteram o Saldo Final do dia.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentPrompt,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text || generateStaticSummary(record, staffList);

  } catch (error) {
    console.error("Erro na IA, usando fallback local:", error);
    // Em caso de qualquer erro (403, 429, 500), retorna o resumo estático
    return generateStaticSummary(record, staffList);
  }
};