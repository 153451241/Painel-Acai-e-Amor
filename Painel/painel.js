// ==========================================================
// IMPORTAÇÕES DO FIREBASE (Completas, com 'doc' e 'updateDoc')
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
  orderBy,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ==========================================================
// PASSO 1.1: CONFIGURAÇÃO DO ALARME (Do seu arquivo)
// ==========================================================
const audioAlarme = new Audio("sounds/toque.mp3");
audioAlarme.volume = 1.0;
audioAlarme.loop = true;
let alarmeTocando = false;
// ==========================================================

// ==========================================================
// PASSO 1: SEGURANÇA (Do seu arquivo)
// ==========================================================
const senhaCorreta = "acai123"; // (Do seu arquivo)
const senhaDigitada = prompt("Digite a senha para acessar o painel:");

if (senhaDigitada !== senhaCorreta) {
  alert("ACESSO NEGADO!");
  document.body.innerHTML =
    "<h1 style='color:red; text-align:center;'>ACESSO NEGADO</h1>";
  throw new Error("Senha incorreta. Acesso bloqueado.");
}

// ==========================================================
// PASSO 2: CONFIGURAÇÃO DO FIREBASE (Do seu arquivo)
// ==========================================================
const firebaseConfig = {
  apiKey: "AIzaSyCGv7FpTQr32Uu-y-BU_uoRVITBQuIy-os",
  authDomain: "geraldo-menu.firebaseapp.com",
  projectId: "geraldo-menu",
  storageBucket: "geraldo-menu.firebasestorage.app",
  messagingSenderId: "1043431004683",
  appId: "1:1043431004683:web:f2405018f58b652d1bc50e",
  measurementId: "G-PF3PRRRCRW",
};

// ==========================================================
// PASSO 3: INICIALIZAÇÃO E LÓGICA DO "DIA DE TRABALHO" (8AM - 5AM)
// ==========================================================
let db;
const listaPedidosContainer = document.getElementById("lista-pedidos-container");
const resumoContainer = document.getElementById("resumo-container");
const modalDetalhe = document.getElementById("modal-detalhe-pedido");
const modalDetalheClose = document.getElementById("modal-detalhe-close");

let todosPedidosDoDia = [];
let filtroAtual = "NOVOS";

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  const statusDiv = document.getElementById("status-conexao");
  statusDiv.textContent = "Conectado! Ouvindo pedidos...";
  statusDiv.className = "status-conectado";
  console.log("Iniciando painel...");

  // --- LÓGICA DO DIA DE TRABALHO (8 AM até 5 AM do dia seguinte) ---
  const agora = new Date();
  const horaCorteInicio = 8; // 8 da manhã
  const horaCorteFim = 5; // 5 da manhã (do dia seguinte)

  let dataInicio = new Date();
  let dataFim = new Date();

  if (agora.getHours() < horaCorteFim) {
    // Se for antes das 5 AM (ex: 3 AM de Terça)
    // O "dia" começou ONTEM (Segunda) às 8 AM
    dataInicio.setDate(agora.getDate() - 1);
    dataInicio.setHours(horaCorteInicio, 0, 0, 0);

    // E o "dia" termina HOJE (Terça) às 5 AM
    dataFim.setHours(horaCorteFim, 0, 0, 0);
  } else {
    // Se for depois das 5 AM (ex: 10 AM de Segunda)
    // O "dia" começou HOJE (Segunda) às 8 AM
    dataInicio.setHours(horaCorteInicio, 0, 0, 0);

    // E o "dia" termina AMANHÃ (Terça) às 5 AM
    dataFim.setDate(agora.getDate() + 1);
    dataFim.setHours(horaCorteFim, 0, 0, 0);
  }

  const dataInicioTimestamp = Timestamp.fromDate(dataInicio);
  const dataFimTimestamp = Timestamp.fromDate(dataFim); // Timestamp de FIM

  console.log(
    `Buscando pedidos de: ${dataInicio.toLocaleString(
      "pt-BR"
    )} até ${dataFim.toLocaleString("pt-BR")}`
  );
  // --- FIM DA LÓGICA DO DIA ---

  // Cria a consulta: Ouve a coleção "pedidos-acai", entre dataInicio e dataFim
  const q = query(
    collection(db, "pedidos-acai"),
    where("data", ">=", dataInicioTimestamp),
    where("data", "<=", dataFimTimestamp)
  );

  // Inicia o "ouvinte" em tempo real
  onSnapshot(q, (snapshot) => {
    let mudancaCritica = false;

    snapshot.docChanges().forEach((change) => {
      const pedido = change.doc.data();
      pedido.id = change.doc.id;

      if (change.type === "added") {
        console.log("Novo pedido recebido:", pedido.id);
        todosPedidosDoDia.push(pedido);
        mudancaCritica = true; // Força o redesenho

        // SÓ TOCA O ALARME SE FOR UM PEDIDO NOVO
        if (pedido.status === "pendente" || pedido.status === undefined) {
          iniciarAlarme();
        }
      }
      if (change.type === "modified") {
        console.log("Pedido modificado:", pedido.id);
        const index = todosPedidosDoDia.findIndex((p) => p.id === pedido.id);
        if (index > -1) {
          todosPedidosDoDia[index] = pedido;
        }
        mudancaCritica = true; // Força o redesenho
      }
      if (change.type === "removed") {
        console.log("Pedido removido:", pedido.id);
        todosPedidosDoDia = todosPedidosDoDia.filter(
          (p) => p.id !== pedido.id
        );
        mudancaCritica = true; // Força o redesenho
      }
    });

    // Para o alarme se o operador aceitar o último pedido pendente
    const temPendentesAinda = todosPedidosDoDia.some(
      (p) => p.status === "pendente" || p.status === undefined
    );
    if (!temPendentesAinda) {
      pararAlarme();
    }

    // Se algo mudou, redesenha a tela
    if (mudancaCritica) {
      atualizarTela();
    }
  });
} catch (error) {
  console.error("Erro na inicialização do Firebase:", error);
  const statusDiv = document.getElementById("status-conexao");
  statusDiv.textContent = "Erro ao conectar com o Firebase.";
  statusDiv.className = "status-erro";
}

// ==========================================================
// PASSO 4: FUNÇÕES AUXILIARES (do seu arquivo)
// ==========================================================
const brl = (n) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;

function iniciarAlarme() {
  if (!alarmeTocando) {
    console.log("Iniciando alarme...");
    let playPromise = audioAlarme.play();
    if (playPromise !== undefined) {
      playPromise
        .then((_) => {
          console.log("Alarme iniciado com sucesso.");
          alarmeTocando = true;
        })
        .catch((error) => {
          console.warn("Áudio bloqueado. Esperando clique na página.", error);
        });
    }
  }
}
function pararAlarme() {
  if (alarmeTocando) {
    console.log("Parando alarme...");
    audioAlarme.pause();
    audioAlarme.currentTime = 0;
    alarmeTocando = false;
  }
}

/**
/**
 * ✨ FUNÇÃO "INTELIGENTE" ATUALIZADA ✨
 * Processa o nome do item e separa em base, adicionais e HTML.
 */
function formatarItemAcai(nomeItem) {
  // Lista de itens que são considerados "Bases"
  const knownBases = ["Açaí", "Cupuaçu"];

  // 1. Verifica se é um Açaí Montado
  if (nomeItem.startsWith("Açaí Montado (") && nomeItem.endsWith(")")) {
    try {
      // 2. Pega a string de dentro dos parênteses
      const allItensString = nomeItem.substring(
        nomeItem.indexOf("(") + 1,
        nomeItem.lastIndexOf(")")
      );
      // 3. Quebra a string em um array de itens
      const allItensArray = allItensString.split(", ");

      if (allItensArray.length >= 1) {
        const tamanho = allItensArray.shift(); // Ex: "300ml"
        
        const basesEncontradas = [];
        const adicionais = [];

        // 4. Separa o que é BASE do que é ADICIONAL
        allItensArray.forEach(item => {
          if (knownBases.includes(item)) {
            basesEncontradas.push(item);
          } else {
            adicionais.push(item);
          }
        });

        // 5. Cria o nome base bonito (Ex: "Açaí + Cupuaçu (300ml)")
        let nomeBaseFormatado = `${basesEncontradas.join(" + ")} (${tamanho})`;
        
        // Se nenhuma base for encontrada (bug?), usa um padrão
        if(basesEncontradas.length === 0) {
            nomeBaseFormatado = `Açaí Montado (${tamanho})`;
        }

        // 6. Cria o HTML bonito
        let html = `<b>${nomeBaseFormatado}</b>`;
        if (adicionais.length > 0) {
          html += `<br><small style="opacity: 0.8; margin-left: 10px;">+ ${adicionais.join(
            ", "
          )}</small>`;
        }

        // 7. Retorna um objeto estruturado
        return {
          nomeBase: nomeBaseFormatado,
          adicionais: adicionais,
          htmlFormatado: html,
        };
      }
    } catch (e) {
      /* Se falhar, só retorna o nome bruto abaixo */
    }
  }

  // Se não for "Açaí Montado" (ex: "Batata") ou se falhar o parse
  return {
    nomeBase: nomeItem,
    adicionais: [],
    htmlFormatado: `<b>${nomeItem}</b>`,
  };
}

// ==========================================================
// PASSO 5: FUNÇÕES DE RENDERIZAÇÃO (LÓGICA DO RESUMO ATUALIZADA)
// ==========================================================

// Função GERAL que decide o que mostrar (Pedidos ou Resumo)
function atualizarTela() {
  if (filtroAtual === "RESUMO") {
    listaPedidosContainer.style.display = "none";
    resumoContainer.style.display = "block";
    renderizarResumo(todosPedidosDoDia); // Chama a nova função de resumo
  } else {
    listaPedidosContainer.style.display = "block";
    resumoContainer.style.display = "none";
    renderizarPedidos(todosPedidosDoDia); // Chama a função de pedidos
  }
}

// Função que desenha os pedidos
function renderizarPedidos(pedidos) {
  if (!listaPedidosContainer) return;
  let cardsHtml = "";

  let pedidosFiltrados = [];
  if (filtroAtual === "TUDO") {
    pedidosFiltrados = pedidos;
  } else if (filtroAtual === "NOVOS") {
    pedidosFiltrados = pedidos.filter(
      (p) => p.status === "pendente" || p.status === undefined
    );
  } else if (filtroAtual === "EM_PREPARO") {
    pedidosFiltrados = pedidos.filter((p) => p.status === "em_preparo");
  } else if (filtroAtual === "FINALIZADO") {
    pedidosFiltrados = pedidos.filter((p) => p.status === "finalizado");
  }

  pedidosFiltrados.sort((a, b) => b.data.toMillis() - a.data.toMillis());

  if (pedidosFiltrados.length === 0) {
    cardsHtml = `<p class="placeholder">Nenhum pedido nesta categoria.</p>`;
  } else {
    pedidosFiltrados.forEach((pedido) => {
      if (filtroAtual === "NOVOS" || filtroAtual === "TUDO") {
        cardsHtml += gerarCardHtmlGrande(pedido);
      } else {
        cardsHtml += gerarCardHtmlCompacto(pedido);
      }
    });
  }
  listaPedidosContainer.innerHTML = cardsHtml;
}

// ==========================================================
// --- 👇 LÓGICA DE RESUMO ATUALIZADA (CORRIGIDA) 👇 ---
// ==========================================================
function renderizarResumo(pedidos) {
  console.log("Renderizando resumo para", pedidos.length, "pedidos");

  // 1. Calcular Estatísticas
  const totalPedidos = pedidos.length;
  // Filtra apenas pedidos válidos (não-pendentes) para o faturamento
  const pedidosValidos = pedidos.filter(
    (p) => p.status === "em_preparo" || p.status === "finalizado"
  );

  const faturamentoTotal = pedidosValidos.reduce(
    (acc, p) => acc + (p.total || 0),
    0
  );
  const totalTaxas = pedidosValidos.reduce(
    (acc, p) => acc + (p.taxa || 0),
    0
  );
  const faturamentoItens = faturamentoTotal - totalTaxas;

  // 2. Agrupar Itens (AGORA SEPARADOS)
  const mapaItensBase = {}; // <-- Mapa para Itens Base (Açaí, etc.)
  const mapaAdicionais = {}; // <-- Mapa para Adicionais (Leite em Pó, etc.)

  pedidosValidos.forEach((p) => {
    p.itens.forEach((item) => {
      // 1. Usa a nova função inteligente
      const itemFormatado = formatarItemAcai(item.name);

      // 2. Conta o item base
      mapaItensBase[itemFormatado.nomeBase] =
        (mapaItensBase[itemFormatado.nomeBase] || 0) + 1;

      // 3. Conta cada adicional
      itemFormatado.adicionais.forEach((adicional) => {
        mapaAdicionais[adicional] = (mapaAdicionais[adicional] || 0) + 1;
      });
    });
  });

  // 3. Atualizar o HTML
  document.getElementById("resumo-total-pedidos").textContent = totalPedidos;
  document.getElementById("resumo-total-faturado").textContent =
    brl(faturamentoItens);
  document.getElementById("resumo-total-taxas").textContent = brl(totalTaxas);

  // 4. Preencher a tabela de PRODUTOS
  const tabelaProdutosBody = document.querySelector(
    "#tabela-produtos-vendidos tbody"
  );
  if (tabelaProdutosBody) {
    if (Object.keys(mapaItensBase).length === 0) {
      tabelaProdutosBody.innerHTML = `<tr><td colspan="2"><p class="placeholder">Nenhum produto vendido ainda.</p></td></tr>`;
    } else {
      const itensOrdenados = Object.entries(mapaItensBase).sort(
        (a, b) => b[1] - a[1]
      );
      let tabelaHtml = "";
      itensOrdenados.forEach(([nome, qtd]) => {
        tabelaHtml += `<tr><td>${nome}</td><td class="qtd">${qtd}x</td></tr>`;
      });
      tabelaProdutosBody.innerHTML = tabelaHtml;
    }
  }

  // 5. Preencher a tabela de ADICIONAIS
  const tabelaAdicionaisBody = document.querySelector(
    "#tabela-adicionais-vendidos tbody"
  );
  if (tabelaAdicionaisBody) {
    if (Object.keys(mapaAdicionais).length === 0) {
      tabelaAdicionaisBody.innerHTML = `<tr><td colspan="2"><p class="placeholder">Nenhum adicional vendido.</p></td></tr>`;
    } else {
      const itensOrdenados = Object.entries(mapaAdicionais).sort(
        (a, b) => b[1] - a[1]
      );
      let tabelaHtml = "";
      itensOrdenados.forEach(([nome, qtd]) => {
        tabelaHtml += `<tr><td>${nome}</td><td class="qtd">${qtd}x</td></tr>`;
      });
      tabelaAdicionaisBody.innerHTML = tabelaHtml;
    }
  }
}
// ==========================================================
// --- FIM DA LÓGICA DE RESUMO ATUALIZADA ---
// ==========================================================

// GERA O HTML DO CARD GRANDE (Para 'Novos' e 'Tudo')
function gerarCardHtmlGrande(pedido) {
  // ✅ CORRIGIDO: Usa a nova função de formatação
  let itensHtml = pedido.itens
    .map((it) => {
      const itemFormatado = formatarItemAcai(it.name); // <-- MUDANÇA
      let obs = it.obs ? ` <i>(Obs: ${it.obs})</i>` : "";
      // 👇 MUDANÇA
      return `<li>${itemFormatado.htmlFormatado} - ${brl(it.price)}${obs}</li>`;
    })
    .join("");

  let obsPagamento = pedido.obsPagamento ? ` (${pedido.obsPagamento})` : "";
  const dataPedido = pedido.data
    .toDate()
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  let tituloCard = "";
  let classeStatus = "";
  let botoesHtml = "";
  let statusReal = pedido.status || "pendente";
  switch (statusReal) {
    case "pendente":
      tituloCard = "🔥 NOVO PEDIDO";
      classeStatus = "status-pendente";
      botoesHtml = `
          <button class="btn-acao btn-aceitar" data-id="${pedido.id}">✅ Aceitar Pedido</button>
          <button class="btn-acao btn-imprimir" data-id="${pedido.id}">🖨️ Imprimir</button>
        `;
      break;
    case "em_preparo":
      tituloCard = "EM PREPARO";
      classeStatus = "status-em_preparo";
      botoesHtml = `
          <button class="btn-acao btn-finalizar" data-id="${pedido.id}">🏁 Finalizar Pedido</button>
          <button class="btn-acao btn-imprimir" data-id="${pedido.id}">🖨️ Imprimir</button>
        `;
      break;
    case "finalizado":
      tituloCard = "Pedido Finalizado";
      classeStatus = "status-finalizado";
      botoesHtml = `
          <button class="btn-acao btn-imprimir" data-id="${pedido.id}">🖨️ Reimprimir</button>
        `;
      break;
  }
  return `
      <div class="pedido-card" data-status="${statusReal}" id="pedido-${pedido.id}">
        <h3 class="${classeStatus}">${tituloCard}</h3>
        <p class="info">
        <b>Pedido: #${pedido.codigo}</b><br>
        <b>Cliente: ${pedido.nomeCliente}</b><br>
          <b>Horário:</b> ${dataPedido}<br>
          <b>Endereço:</b> ${pedido.endereco}<br>
          <b>Pagamento:</b> ${pedido.pagamento}${obsPagamento}
        </p>
        <b>Itens:</b>
        <ul>${itensHtml}</ul>
        <h3 class="total">Total: ${brl(pedido.total)}</h3>
        <div class="botoes-acao">
            ${botoesHtml}
        </div>
      </div>
    `;
}

// GERA O HTML DO CARD COMPACTO (Para 'Em Preparo' e 'Finalizado')
function gerarCardHtmlCompacto(pedido) {
  // (Esta função é a mesma da versão anterior, sem mudanças)
  const dataPedido = pedido.data
    .toDate()
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  let tituloCard = "";
  let botoesHtml = "";
  if (pedido.status === "em_preparo") {
    tituloCard = "EM PREPARO";
    botoesHtml = `<button class="btn-acao btn-finalizar" data-id="${pedido.id}">🏁 Finalizar</button>`;
  } else {
    tituloCard = "FINALIZADO";
    botoesHtml = `<button class="btn-acao btn-imprimir" data-id="${pedido.id}">🖨️ Imprimir</button>`;
  }
  return `
      <div class="pedido-card compact" data-status="${pedido.status}" data-id="${pedido.id}">
        <div class="compact-info">
          <h3 class="${
            pedido.status === "em_preparo"
              ? "status-em_preparo"
              : "status-finalizado"
          }">${tituloCard} (${dataPedido})</h3>
          <p class="info">
           <b>#${pedido.codigo}</b> | <b>${pedido.nomeCliente}</b> | ${
    pedido.endereco
  } | <b>${brl(pedido.total)}</b>
          </p>
        </div>
        <div class="compact-botoes">
            ${botoesHtml}
        </div>
      </div>
    `;
}

// ==========================================================
// PASSO 6: LÓGICA DO MODAL DE DETALHES (do seu arquivo)
// ==========================================================
function abrirModalDetalhes(pedido) {
  document.getElementById("detalhe-titulo").textContent = `Pedido (${pedido.data
    .toDate()
    .toLocaleTimeString("pt-BR")})`;
  
  // ✅ CORRIGIDO: Usa a nova função de formatação
  let itensHtml = pedido.itens
    .map((it) => {
      const itemFormatado = formatarItemAcai(it.name); // <-- MUDANÇA
      let obs = it.obs ? ` <i>(Obs: ${it.obs})</i>` : "";
      // 👇 MUDANÇA
      return `<li>${itemFormatado.htmlFormatado} - ${brl(it.price)}${obs}</li>`;
    })
    .join("");
  document.getElementById("detalhe-lista-itens").innerHTML = itensHtml;

  let obsPagamento = pedido.obsPagamento ? ` (${pedido.obsPagamento})` : "";
  const dataPedido = pedido.data.toDate().toLocaleString("pt-BR");
  document.getElementById("detalhe-info").innerHTML = `
    <b>Código:<b>${pedido.codigo}</br>
    <b>Cliente: ${pedido.nomeCliente}</b><br>
      <b>Horário:</b> ${dataPedido}<br>
      <b>Endereço:</b> ${pedido.endereco}<br>
      <b>Pagamento:</b> ${pedido.pagamento}${obsPagamento}
    `;
  document.getElementById("detalhe-total").innerHTML =
    `Total: ${brl(pedido.total)}`;
  const botoesModal = document.getElementById("detalhe-botoes");
  if (pedido.status === "em_preparo") {
    botoesModal.innerHTML = `
          <button class="btn-acao btn-finalizar" data-id="${pedido.id}">🏁 Finalizar Pedido</button>
          <button class="btn-acao btn-imprimir" data-id="${pedido.id}">🖨️ Imprimir</button>
        `;
  } else if (pedido.status === "finalizado") {
    botoesModal.innerHTML = `<button class="btn-acao btn-imprimir" data-id="${pedido.id}">🖨️ Reimprimir</button>`;
  } else {
    botoesModal.innerHTML = "";
  }
  if (modalDetalhe) modalDetalhe.style.display = "flex";
}

function fecharModalDetalhes() {
  if (modalDetalhe) modalDetalhe.style.display = "none";
}
if (modalDetalheClose) modalDetalheClose.onclick = fecharModalDetalhes;
if (modalDetalhe)
  modalDetalhe.onclick = function (event) {
    if (event.target == modalDetalhe) {
      fecharModalDetalhes();
    }
  };

// ==========================================================
// PASSO 7: FUNÇÃO DE IMPRESSÃO (do seu arquivo)
// ==========================================================
function imprimirComanda(pedido) {
  const loja = document.getElementById("comanda-loja");
  const lista = document.getElementById("comanda-lista");
  const total = document.getElementById("comanda-total");
  const tipo = document.getElementById("comanda-tipo");
  const cliente = document.getElementById("comanda-cliente");
  const endereco = document.getElementById("comanda-endereco");
  const pagamento = document.getElementById("comanda-pagamento");
  const obsPagamento = document.getElementById("comanda-obs-pagamento");

  if (!loja || !lista || !total)
    return console.error("Erro: Elementos de comanda faltando.");
  lista.innerHTML = "";
  loja.textContent = `Açaí & Amor - Pedido #${pedido.codigo}`;

  // ✅ CORRIGIDO: Usa a nova função de formatação
  pedido.itens.forEach((it) => {
    const li = document.createElement("li");
    const itemFormatado = formatarItemAcai(it.name); // <-- MUDANÇA
    let nomeHtml = itemFormatado.htmlFormatado; // <-- MUDANÇA
    if (it.obs) {
      nomeHtml += ` <br><i>(Obs: ${it.obs})</i>`;
    }
    // 👇 MUDANÇA
    li.innerHTML = `<b>${nomeHtml}</b> <span>${brl(it.price)}</span>`;
    lista.appendChild(li);
  });

  total.innerHTML = `TOTAL: ${brl(pedido.total)}`;
  const eRetirada = pedido.endereco === "Retirada no local";

  tipo.textContent = eRetirada ? "*** RETIRADA ***" : "*** ENTREGA ***";
  cliente.textContent = `Cliente: ${pedido.nomeCliente}`;
  endereco.textContent = eRetirada
    ? "Retirada na loja."
    : `Endereço: ${pedido.endereco}`;
  pagamento.textContent = `Pagamento: ${pedido.pagamento}`;
  obsPagamento.textContent = pedido.obsPagamento || "";

  console.log("Chamando a janela de impressão...");
  try {
    window.print();
  } catch (e) {
    console.error("Erro ao chamar window.print():", e);
  }
}

// ==========================================================
// PASSO 8: OUVINTE DE CLIQUES (do seu arquivo)
// ==========================================================
// (Esta função é a mesma da versão anterior, sem mudanças)
const painelNav = document.querySelector(".painel-nav");
if (painelNav) {
  painelNav.addEventListener("click", (e) => {
    const botaoFiltro = e.target.closest("button");
    if (botaoFiltro) {
      filtroAtual = botaoFiltro.dataset.filtro;
      console.log("Filtro mudou para:", filtroAtual);

      document
        .querySelectorAll(".painel-nav button")
        .forEach((btn) => {
          btn.classList.remove("active");
        });
      botaoFiltro.classList.add("active");

      atualizarTela();
    }
  });
}
if (listaPedidosContainer) {
  listaPedidosContainer.addEventListener("click", async (e) => {
    let target = e.target;
    let botaoAcao = target.closest(".btn-acao");
    let cardClicavel = target.closest(".pedido-card");

    if (botaoAcao) {
      e.stopPropagation();
      const pedidoId = botaoAcao.dataset.id;
      if (!pedidoId) return;

      const pedidoParaAcao = todosPedidosDoDia.find((p) => p.id === pedidoId);
      if (!pedidoParaAcao) return;

      if (botaoAcao.classList.contains("btn-aceitar")) {
        pararAlarme();
        console.log(`Aceitando pedido ${pedidoId}...`);
        const docRef = doc(db, "pedidos-acai", pedidoId);
        try {
          await updateDoc(docRef, {
            status: "em_preparo",
          });
          imprimirComanda(pedidoParaAcao);
        } catch (err) {
          console.error("Erro ao aceitar pedido:", err);
        }
      } else if (botaoAcao.classList.contains("btn-finalizar")) {
        console.log(`Finalizando pedido ${pedidoId}...`);
        const docRef = doc(db, "pedidos-acai", pedidoId);
        try {
          await updateDoc(docRef, {
            status: "finalizado",
          });
          fecharModalDetalhes();
        } catch (err) {
          console.error("Erro ao finalizar pedido:", err);
        }
      } else if (botaoAcao.classList.contains("btn-imprimir")) {
        console.log(`Imprimindo pedido ${pedidoId}...`);
        imprimirComanda(pedidoParaAcao);
      }
    } else if (cardClicavel) {
      if (cardClicavel.classList.contains("compact")) {
        const pedidoId = cardClicavel.dataset.id;
        if (!pedidoId) return;
        const pedidoParaDetalhe = todosPedidosDoDia.find(
          (p) => p.id === pedidoId
        );
        if (pedidoParaDetalhe) {
          console.log("Abrindo detalhes do pedido:", pedidoId);
          abrirModalDetalhes(pedidoParaDetalhe);
        }
      }
    }
  });
}
const botoesModal = document.getElementById("detalhe-botoes");
if (botoesModal) {
  botoesModal.addEventListener("click", async (e) => {
    const botaoAcao = e.target.closest(".btn-acao");
    if (!botaoAcao) return;
    const pedidoId = botaoAcao.dataset.id;
    if (!pedidoId) return;
    const pedidoParaAcao = todosPedidosDoDia.find((p) => p.id === pedidoId);
    if (!pedidoParaAcao) return;
    if (botaoAcao.classList.contains("btn-finalizar")) {
      console.log(`Finalizando pedido ${pedidoId}...`);
      const docRef = doc(db, "pedidos-acai", pedidoId);
      try {
        await updateDoc(docRef, { status: "finalizado" });
        fecharModalDetalhes();
      } catch (err) {
        console.error("Erro ao finalizar pedido:", err);
      }
    } else if (botaoAcao.classList.contains("btn-imprimir")) {
      console.log(`Imprimindo pedido ${pedidoId}...`);
      imprimirComanda(pedidoParaAcao);
    }
  });
}

// ==========================================================
// PASSO 9: LÓGICA DO PDF (LÓGICA ATUALIZADA) - CÓDIGO CORRIGIDO
// ==========================================================
const btnGerarPdf = document.getElementById("btn-gerar-pdf");
if (btnGerarPdf) {
  btnGerarPdf.addEventListener("click", () => {
    // 1. Pega o CONSTRUTOR do jsPDF
    const { jsPDF } = window.jspdf;

    // 2. Apenas checa se o construtor principal foi carregado
    if (!jsPDF) {
      console.error("jsPDF não carregado!");
      alert("Erro ao carregar a biblioteca do PDF. Recarregue a página.");
      return;
    }

    // 3. A checagem do autoTable é feita DENTRO da função gerarPDF
    gerarPDF(todosPedidosDoDia, jsPDF); // Gera o PDF com os dados do dia
  });
}

function gerarPDF(pedidos, jsPDF) {
  console.log("Gerando PDF...");
  const doc = new jsPDF();

  // Verifica se o plugin autoTable está anexado
  if (typeof doc.autoTable !== "function") {
    console.error("Plugin jsPDF-AutoTable não carregado!");
    alert("Erro ao carregar o plugin da tabela PDF. Recarregue a página.");
    return;
  }

  // --- 1. CALCULAR ESTATÍSTICAS (LÓGICA CORRIGIDA) ---
  const pedidosValidos = pedidos.filter(
    (p) => p.status === "em_preparo" || p.status === "finalizado"
  );
  const faturamentoTotal = pedidosValidos.reduce(
    (acc, p) => acc + (p.total || 0),
    0
  );
  const totalTaxas = pedidosValidos.reduce((acc, p) => acc + (p.taxa || 0), 0);
  const faturamentoItens = faturamentoTotal - totalTaxas;
  const totalPedidos = pedidos.length;

  // --- LÓGICA DE AGRUPAMENTO SEPARADA (CORRIGIDA) ---
  const mapaItensBase = {}; // <-- Mapa para Itens Base
  const mapaAdicionais = {}; // <-- Mapa para Adicionais

  pedidosValidos.forEach((p) => {
    p.itens.forEach((item) => {
      // 1. Usa a nova função inteligente
      const itemFormatado = formatarItemAcai(item.name);

      // 2. Conta o item base
      mapaItensBase[itemFormatado.nomeBase] =
        (mapaItensBase[itemFormatado.nomeBase] || 0) + 1;

      // 3. Conta cada adicional
      itemFormatado.adicionais.forEach((adicional) => {
        mapaAdicionais[adicional] = (mapaAdicionais[adicional] || 0) + 1;
      });
    });
  });
  // --- FIM DA LÓGICA DE AGRUPAMENTO ---

  const itensOrdenadosBase = Object.entries(mapaItensBase).sort(
    (a, b) => b[1] - a[1]
  );
  const itensOrdenadosAdicionais = Object.entries(mapaAdicionais).sort(
    (a, b) => b[1] - a[1]
  );

  // --- 2. ADICIONAR CONTEÚDO AO PDF ---
  doc.setFontSize(18);
  doc.text("Resumo de Vendas do Dia (Açaí & Amor)", 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 29);

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("ESTATÍSTICAS GERAIS", 14, 40);

  // Chama o autoTable direto do 'doc'
  doc.autoTable({
    startY: 45,
    theme: "striped",
    head: [["Métrica", "Valor"]],
    body: [
      ["Total de Pedidos Recebidos", totalPedidos],
      ["Pedidos Válidos (Aceitos/Finalizados)", pedidosValidos.length],
      ["Faturamento (só Itens)", brl(faturamentoItens)],
      ["Total de Taxas de Entrega", brl(totalTaxas)],
      ["FATURAMENTO TOTAL", brl(faturamentoTotal)],
    ],
  });

  let startY = doc.lastAutoTable.finalY + 15;

  // Tabela de Produtos
  doc.text("PRODUTOS VENDIDOS", 14, startY);
  doc.autoTable({
    startY: startY + 5,
    theme: "grid",
    head: [["Produto", "Quantidade"]],
    body: itensOrdenadosBase.map(([nome, qtd]) => [nome, `${qtd}x`]),
  });

  startY = doc.lastAutoTable.finalY + 15;

  // Tabela de Adicionais
  doc.text("ADICIONAIS VENDIDOS", 14, startY);
  doc.autoTable({
    startY: startY + 5,
    theme: "grid",
    head: [["Adicional", "Quantidade"]],
    body: itensOrdenadosAdicionais.map(([nome, qtd]) => [nome, `${qtd}x`]),
  });

  // --- 3. SALVAR O PDF ---
  const nomeArquivo = `Resumo_Dia_${new Date()
    .toLocaleDateString("pt-BR")
    .replace(/\//g, "-")}.pdf`;
  doc.save(nomeArquivo);
  console.log("PDF Gerado!");
}