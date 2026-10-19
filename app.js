const imagem = document.getElementById("imagemPrateleira");
const scene = document.getElementById("scene");
const marcacao = document.getElementById("marcacao");
const resetButton = document.getElementById("resetButton");
const status = document.getElementById("status");
const emptyState = document.getElementById("emptyState");
const floorButtons = [...document.querySelectorAll(".floor-button")];
const viewerTitle = document.getElementById("viewerTitle");
const zoomBadge = document.getElementById("zoomBadge");
const itemCount = document.getElementById("itemCount");
const itemInput = document.getElementById("itemInput");
const itemForm = document.getElementById("itemForm");
const addItemButton = document.getElementById("addItemButton");
const itemList = document.getElementById("itemList");
const infoHint = document.getElementById("infoHint");
const shelfSelect = document.getElementById("shelfSelect");
const shelfForm = document.getElementById("shelfForm");
const shelfNameInput = document.getElementById("shelfName");
const shelfPhotoInput = document.getElementById("shelfPhoto");
const cameraButton = document.getElementById("cameraButton");
const saveShelfButton = document.getElementById("saveShelfButton");
const shelfNote = document.getElementById("shelfNote");
const CHAVE_INFO = "prateleira-informacoes-andares";
const CHAVE_PRATELEIRAS = "visualizador-prateleiras-local";
const PRINCIPAL_ID = "principal";
const prateleiras = [{ id: PRINCIPAL_ID, nome: "Prateleira principal", foto: null }];
let prateleiraAtual = PRINCIPAL_ID;

function carregarInformacoes() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_INFO) || "{}") || {};
    // Upgrade earlier single string values into one-item lists.
    for (const [id, valor] of Object.entries(dados)) {
      const chave = id.includes(":") ? id : `${PRINCIPAL_ID}:${id}`;
      if (typeof valor === "string") dados[chave] = valor.trim() ? [valor] : [];
      else if (Array.isArray(valor)) dados[chave] = valor;
      else dados[chave] = [];
      if (chave !== id) delete dados[id];
    }
    return dados;
  } catch {
    return {};
  }
}

const informacoes = carregarInformacoes();
let selectedFloorId = "";

function salvarInformacoes() {
  try {
    localStorage.setItem(CHAVE_INFO, JSON.stringify(informacoes));
    return true;
  } catch {
    return false;
  }
}

function renderizarItens(id) {
  itemList.replaceChildren();
  const chave = `${prateleiraAtual}:${id}`;
  const itens = informacoes[chave] || [];
  itemCount.textContent = itens.length;

  if (itens.length === 0) {
    const vazio = document.createElement("li");
    vazio.className = "item-empty";
    vazio.textContent = "Nenhum item cadastrado neste andar ainda.";
    itemList.append(vazio);
    return;
  }

  itens.forEach((item, indice) => {
    const linha = document.createElement("li");
    linha.className = "item-row";
    const nome = document.createElement("span");
    nome.textContent = item;
    const remover = document.createElement("button");
    remover.type = "button";
    remover.textContent = "Remover";
    remover.setAttribute("aria-label", `Remover ${item}`);
    remover.addEventListener("click", () => {
      informacoes[chave].splice(indice, 1);
      const salvo = salvarInformacoes();
      renderizarItens(id);
      infoHint.textContent = salvo ? "Item removido e lista salva." : "Item removido, mas não foi possível salvar neste navegador.";
    });
    linha.append(nome, remover);
    itemList.append(linha);
  });
}

// Stable IDs map to image positions. Andar 1 is at the bottom of the image.
const andares = {
  "andar-1": { numero: 1, topo: 5 / 6 * 100 },
  "andar-2": { numero: 2, topo: 4 / 6 * 100 },
  "andar-3": { numero: 3, topo: 3 / 6 * 100 },
  "andar-4": { numero: 4, topo: 2 / 6 * 100 },
  "andar-5": { numero: 5, topo: 1 / 6 * 100 },
  "andar-6": { numero: 6, topo: 0 }
};
const TOTAL_ANDARES = Object.keys(andares).length;
const ZOOM = 2.15;

function carregarPrateleiras() {
  try {
    const salvas = JSON.parse(localStorage.getItem(CHAVE_PRATELEIRAS) || "[]");
    salvas.forEach((salva) => {
      if (salva?.id && salva?.nome && typeof salva.foto === "string") prateleiras.push(salva);
    });
  } catch {
    shelfNote.textContent = "Não foi possível ler as prateleiras salvas neste navegador.";
  }
  atualizarSeletorPrateleiras();
}

function guardarPrateleiras() {
  const salvas = prateleiras.filter((item) => item.id !== PRINCIPAL_ID);
  localStorage.setItem(CHAVE_PRATELEIRAS, JSON.stringify(salvas));
}

async function cadastrarPrateleira(nome, arquivoFoto) {
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) throw new Error("Informe o nome da prateleira.");
  if (!(arquivoFoto instanceof Blob) || !arquivoFoto.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem válido.");
  }

  const foto = await normalizarFoto(arquivoFoto);
  const novaPrateleira = {
    id: `prateleira-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`,
    nome: nomeLimpo,
    foto
  };
  prateleiras.push(novaPrateleira);
  try {
    guardarPrateleiras();
  } catch (erro) {
    prateleiras.pop();
    if (erro.name === "QuotaExceededError") {
      throw new Error("O localStorage está cheio. Tente uma foto com menos detalhes.");
    }
    throw new Error("O navegador bloqueou o acesso ao localStorage desta página.");
  }
  atualizarSeletorPrateleiras();
  selecionarPrateleira(novaPrateleira.id);
  return novaPrateleira;
}

function atualizarSeletorPrateleiras() {
  shelfSelect.replaceChildren();
  prateleiras.forEach((prateleira) => {
    const option = document.createElement("option");
    option.value = prateleira.id;
    option.textContent = prateleira.nome;
    shelfSelect.append(option);
  });
  shelfSelect.value = prateleiraAtual;
}

function selecionarPrateleira(id) {
  const prateleira = prateleiras.find((item) => item.id === id);
  if (!prateleira) return;
  prateleiraAtual = id;
  imagem.src = prateleira.foto || "prateleira.jpg";
  imagem.alt = `Foto da ${prateleira.nome}, com seis andares`;
  zoomPorId("");
  viewerTitle.textContent = prateleira.nome;
  infoHint.textContent = `Itens salvos para ${prateleira.nome}.`;
}

function dimensoesDaFoto(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const teste = new Image();
    teste.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ largura: teste.naturalWidth, altura: teste.naturalHeight });
    };
    teste.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem selecionada."));
    };
    teste.src = url;
  });
}

async function normalizarFoto(arquivo) {
  const dimensoes = await dimensoesDaFoto(arquivo);
  const largura = imagem.naturalWidth || 1152;
  const altura = imagem.naturalHeight || 1536;
  const bitmap = await createImageBitmap(arquivo);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível preparar a foto.");
  contexto.fillStyle = "#f4f6f5";
  contexto.fillRect(0, 0, largura, altura);
  const escala = Math.min(largura / bitmap.width, altura / bitmap.height);
  const larguraFoto = bitmap.width * escala;
  const alturaFoto = bitmap.height * escala;
  contexto.drawImage(bitmap, (largura - larguraFoto) / 2, (altura - alturaFoto) / 2, larguraFoto, alturaFoto);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.72);
}

function zoomPorId(id) {
  const andar = andares[id];

  if (!andar) {
    if (id) return false;
    selectedFloorId = "";
    floorButtons.forEach((botao) => {
      botao.classList.remove("active");
      botao.setAttribute("aria-pressed", "false");
    });
    itemInput.value = "";
    itemInput.disabled = true;
    itemInput.placeholder = "Selecione um andar primeiro";
    addItemButton.disabled = true;
    itemList.replaceChildren();
    itemCount.textContent = "—";
    infoHint.textContent = "A informação será guardada separadamente para cada andar neste navegador.";
    scene.style.transform = "translateY(0) scale(1)";
    marcacao.classList.remove("visivel");
    resetButton.disabled = true;
    emptyState.classList.remove("oculto");
    status.textContent = "Exibindo a prateleira completa.";
    viewerTitle.textContent = prateleiras.find((item) => item.id === prateleiraAtual)?.nome || "Prateleira completa";
    zoomBadge.textContent = "VISTA GERAL";
    zoomBadge.classList.remove("zoomed");
    resetButton.setAttribute("aria-pressed", "true");
    return false;
  }

  selectedFloorId = id;
  floorButtons.forEach((botao) => {
    const ativo = botao.dataset.floor === id;
    botao.classList.toggle("active", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
  });
  itemInput.disabled = false;
  itemInput.placeholder = "Digite o nome de um item";
  addItemButton.disabled = false;
  informacoes[`${prateleiraAtual}:${id}`] ||= [];
  renderizarItens(id);
  infoHint.textContent = `Informação vinculada ao ${andar.numero}º andar.`;

  const faixa = 100 / TOTAL_ANDARES;
  const centro = andar.topo + faixa / 2;
  const altura = scene.clientHeight;
  // Shift the chosen shelf's center to the center of the viewport, then zoom.
  const deslocamento = (0.5 - centro / 100) * altura * ZOOM;

  marcacao.style.top = `${andar.topo}%`;
  marcacao.style.height = `${faixa}%`;
  marcacao.classList.remove("visivel");
  scene.style.transform = `translateY(${deslocamento}px) scale(${ZOOM})`;
  resetButton.disabled = false;
  resetButton.setAttribute("aria-pressed", "false");
  emptyState.classList.add("oculto");
  status.textContent = `Andar ${andar.numero} selecionado e ampliado.`;
  const nomePrateleira = prateleiras.find((item) => item.id === prateleiraAtual)?.nome || "Prateleira";
  viewerTitle.textContent = `${nomePrateleira} · Andar ${andar.numero}`;
  zoomBadge.textContent = "ZOOM ATIVO";
  zoomBadge.classList.add("zoomed");
  return true;
}

// Exposes the function for other scripts or the browser console:
// zoomPorId("andar-1")
window.zoomPorId = zoomPorId;
window.cadastrarPrateleira = cadastrarPrateleira;

shelfSelect.addEventListener("change", () => selecionarPrateleira(shelfSelect.value));

cameraButton.addEventListener("click", () => {
  shelfPhotoInput.setAttribute("capture", "environment");
  shelfPhotoInput.click();
});

shelfForm.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const nome = shelfNameInput.value.trim();
  const foto = shelfPhotoInput.files?.[0];
  if (!nome || !foto) {
    shelfNote.textContent = "Informe o nome e escolha uma foto.";
    status.textContent = "Preencha o nome e escolha uma foto para salvar a prateleira.";
    return;
  }
  if (!foto.type.startsWith("image/")) {
    shelfNote.textContent = "Escolha um arquivo de imagem válido.";
    status.textContent = "O arquivo escolhido não é uma imagem válida.";
    return;
  }

  saveShelfButton.disabled = true;
  shelfNote.textContent = "Conferindo e salvando a foto neste navegador…";
  status.textContent = "Preparando e salvando a foto localmente…";
  status.classList.remove("erro");
  try {
    await cadastrarPrateleira(nome, foto);
    shelfForm.reset();
    shelfForm.closest("details").open = false;
    shelfNote.textContent = "Foto salva localmente neste navegador.";
    status.textContent = `Prateleira “${nome}” salva e selecionada.`;
  } catch (erro) {
    shelfNote.textContent = erro.message || "Não foi possível salvar a foto neste navegador.";
    status.textContent = `Falha ao salvar: ${shelfNote.textContent}`;
    status.classList.add("erro");
  } finally {
    saveShelfButton.disabled = false;
  }
});

carregarPrateleiras();

floorButtons.forEach((botao) => {
  botao.setAttribute("aria-pressed", "false");
  botao.addEventListener("click", () => zoomPorId(botao.dataset.floor));
});

itemForm.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const id = selectedFloorId;
  if (!andares[id]) return;

  const item = itemInput.value.trim();
  if (!item) return;
  const chave = `${prateleiraAtual}:${id}`;
  informacoes[chave] ||= [];
  informacoes[chave].push(item);
  const salvo = salvarInformacoes();
  itemInput.value = "";
  renderizarItens(id);
  infoHint.textContent = salvo ? `Item adicionado ao ${andares[id].numero}º andar e salvo neste navegador.` : "Item adicionado, mas não foi possível salvar neste navegador.";
  itemInput.focus();
});

resetButton.addEventListener("click", () => {
  zoomPorId("");
  floorButtons[0]?.focus();
});

imagem.addEventListener("error", () => {
  status.textContent = "Não foi possível carregar prateleira.jpg. Verifique se a imagem está na mesma pasta da página.";
  status.classList.add("erro");
});

// Recalculate the centering after a responsive layout change.
window.addEventListener("resize", () => {
  if (selectedFloorId) zoomPorId(selectedFloorId);
});
