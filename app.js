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
const openShelfFormButton = document.getElementById("openShelfFormButton");
const backToViewerButton = document.getElementById("backToViewerButton");
const cancelRegistrationButton = document.getElementById("cancelRegistrationButton");
const viewerScreen = document.getElementById("viewerScreen");
const registerScreen = document.getElementById("registerScreen");
const menuToggle = document.getElementById("menuToggle");
const menuBackdrop = document.getElementById("menuBackdrop");
const shelfNameInput = document.getElementById("shelfName");
const shelfPhotoInput = document.getElementById("shelfPhoto");
const cameraButton = document.getElementById("cameraButton");
const cameraDialog = document.getElementById("cameraDialog");
const cameraVideo = document.getElementById("cameraVideo");
const cameraError = document.getElementById("cameraError");
const takePhotoButton = document.getElementById("takePhotoButton");
const photoEditorDialog = document.getElementById("photoEditorDialog");
const editorPhoto = document.getElementById("editorPhoto");
const editorError = document.getElementById("editorError");
const photoZoom = document.getElementById("photoZoom");
const photoZoomValue = document.getElementById("photoZoomValue");
const photoOffsetX = document.getElementById("photoOffsetX");
const photoOffsetY = document.getElementById("photoOffsetY");
let arquivoEmEdicao = null;
let urlFotoEdicao = null;
let fotoPronta = false;
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

async function carregarPrateleiras() {
  let falhaServidor = false;
  try {
    const resposta = await fetch("api.php", { headers: { Accept: "application/json" } });
    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.error || "Não foi possível consultar o banco de dados.");
    (Array.isArray(resultado.shelves) ? resultado.shelves : []).forEach((salva) => {
      if (salva?.id && salva?.nome && salva?.foto && !prateleiras.some((item) => item.id === salva.id)) {
        prateleiras.push(salva);
      }
    });
  } catch (erro) {
    falhaServidor = true;
    shelfNote.textContent = `Banco de dados indisponível: ${erro.message}. Abra o projeto pelo XAMPP.`;
  }

  // Mantém acessíveis as prateleiras legadas que estavam salvas neste navegador.
  try {
    const locais = JSON.parse(localStorage.getItem(CHAVE_PRATELEIRAS) || "[]");
    locais.forEach((salva) => {
      if (salva?.id && salva?.nome && typeof salva.foto === "string" && !prateleiras.some((item) => item.id === salva.id)) {
        prateleiras.push(salva);
      }
    });
  } catch { /* Ignora dados antigos inválidos do navegador. */ }

  atualizarSeletorPrateleiras();
  if (falhaServidor) status.classList.add("erro");
}

async function cadastrarPrateleira(nome, arquivoFoto) {
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) throw new Error("Informe o nome da prateleira.");
  if (!(arquivoFoto instanceof Blob) || !arquivoFoto.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem válido.");
  }

  const foto = await normalizarFoto(arquivoFoto);
  const dados = new FormData();
  dados.append("name", nomeLimpo);
  dados.append("photo", foto, "prateleira.jpg");
  const resposta = await fetch("api.php", { method: "POST", body: dados, headers: { Accept: "application/json" } });
  const resultado = await resposta.json();
  if (!resposta.ok) throw new Error(resultado.error || "Não foi possível salvar a prateleira no banco de dados.");

  const novaPrateleira = { id: resultado.shelf.id, nome: resultado.shelf.nome, foto: resultado.shelf.foto };
  prateleiras.push(novaPrateleira);
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

function fecharCamera() {
  cameraVideo.srcObject?.getTracks().forEach((track) => track.stop());
  cameraVideo.srcObject = null;
  takePhotoButton.disabled = true;
  if (cameraDialog.open) cameraDialog.close();
}

async function abrirCamera() {
  cameraError.textContent = "";
  if (!navigator.mediaDevices?.getUserMedia) {
    shelfNote.textContent = "A câmera da página exige uma conexão segura. Abrindo o seletor de fotos do celular.";
    shelfPhotoInput.click();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, aspectRatio: { ideal: 3 / 4 } }
    });
    cameraVideo.srcObject = stream;
    cameraDialog.showModal();
    await cameraVideo.play();
  } catch {
    fecharCamera();
    cameraError.textContent = "Não foi possível abrir a câmera. Verifique a permissão do navegador.";
    shelfNote.textContent = "Câmera indisponível ou sem permissão. Abrindo o seletor de fotos do celular.";
    shelfPhotoInput.click();
  }
}

function tirarFoto() {
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) return;
  takePhotoButton.disabled = true;
  const canvas = document.createElement("canvas");
  canvas.width = cameraVideo.videoWidth;
  canvas.height = cameraVideo.videoHeight;
  canvas.getContext("2d").drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) {
      cameraError.textContent = "Não foi possível capturar a foto. Tente novamente.";
      takePhotoButton.disabled = false;
      return;
    }
    const arquivo = new File([blob], "foto-prateleira.jpg", { type: "image/jpeg" });
    fecharCamera();
    abrirEditorDaFoto(arquivo);
  }, "image/jpeg", 0.9);
}

function atualizarPreviaEditor() {
  const zoom = Number(photoZoom.value);
  photoZoomValue.value = `${zoom.toFixed(1)}×`;
  editorPhoto.style.transform = `translate(${photoOffsetX.value}%, ${photoOffsetY.value}%) scale(${zoom})`;
}

function abrirEditorDaFoto(arquivo) {
  arquivoEmEdicao = arquivo;
  fotoPronta = false;
  if (urlFotoEdicao) URL.revokeObjectURL(urlFotoEdicao);
  urlFotoEdicao = URL.createObjectURL(arquivo);
  editorPhoto.src = urlFotoEdicao;
  photoZoom.value = "1";
  photoOffsetX.value = "0";
  photoOffsetY.value = "0";
  editorError.textContent = "";
  atualizarPreviaEditor();
  photoEditorDialog.showModal();
}

function cancelarEdicaoDaFoto() {
  fotoPronta = false;
  arquivoEmEdicao = null;
  shelfPhotoInput.value = "";
  if (urlFotoEdicao) URL.revokeObjectURL(urlFotoEdicao);
  urlFotoEdicao = null;
  if (photoEditorDialog.open) photoEditorDialog.close();
}

async function confirmarEdicaoDaFoto() {
  if (!arquivoEmEdicao) return;
  const botao = document.getElementById("usePhotoButton");
  botao.disabled = true;
  editorError.textContent = "Preparando a foto…";
  try {
    const bitmap = await createImageBitmap(arquivoEmEdicao);
    const largura = imagem.naturalWidth || 1152;
    const altura = imagem.naturalHeight || 1536;
    const escalaBase = Math.max(largura / bitmap.width, altura / bitmap.height);
    const escala = escalaBase * Number(photoZoom.value);
    const larguraFoto = bitmap.width * escala;
    const alturaFoto = bitmap.height * escala;
    const deslocamentoX = Number(photoOffsetX.value) / 100 * largura;
    const deslocamentoY = Number(photoOffsetY.value) / 100 * altura;
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext("2d");
    contexto.fillStyle = "#f4f6f5";
    contexto.fillRect(0, 0, largura, altura);
    contexto.drawImage(bitmap, (largura - larguraFoto) / 2 + deslocamentoX, (altura - alturaFoto) / 2 + deslocamentoY, larguraFoto, alturaFoto);
    bitmap.close();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((resultado) => resultado ? resolve(resultado) : reject(new Error("Não foi possível gerar a foto editada.")), "image/jpeg", 0.86);
    });
    const fotoEditada = new File([blob], "prateleira-editada.jpg", { type: "image/jpeg" });
    const transferencia = new DataTransfer();
    transferencia.items.add(fotoEditada);
    shelfPhotoInput.files = transferencia.files;
    fotoPronta = true;
    shelfNote.textContent = "Foto ajustada. Agora preencha o nome e salve a prateleira.";
    status.textContent = "Foto editada e pronta para salvar como prateleira.";
    if (urlFotoEdicao) URL.revokeObjectURL(urlFotoEdicao);
    urlFotoEdicao = null;
    arquivoEmEdicao = null;
    photoEditorDialog.close();
  } catch (erro) {
    editorError.textContent = erro.message || "Não foi possível editar esta foto.";
  } finally {
    botao.disabled = false;
  }
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

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((resultado) => resultado ? resolve(resultado) : reject(new Error("Não foi possível gerar a foto ajustada.")), "image/jpeg", 0.82);
  });
  return new File([blob], "prateleira.jpg", { type: "image/jpeg" });
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

function fecharMenuLateral() {
  document.body.classList.remove("menu-open");
  menuBackdrop.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir menu");
}

menuToggle.addEventListener("click", () => {
  const aberto = document.body.classList.toggle("menu-open");
  menuBackdrop.hidden = !aberto;
  menuToggle.setAttribute("aria-expanded", String(aberto));
  menuToggle.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
});
menuBackdrop.addEventListener("click", fecharMenuLateral);
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") fecharMenuLateral();
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 620) fecharMenuLateral();
});

shelfSelect.addEventListener("change", () => {
  selecionarPrateleira(shelfSelect.value);
  fecharMenuLateral();
});
openShelfFormButton.addEventListener("click", () => {
  fecharMenuLateral();
  viewerScreen.hidden = true;
  registerScreen.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  shelfNameInput.focus();
});
backToViewerButton.addEventListener("click", () => {
  registerScreen.hidden = true;
  viewerScreen.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});
cancelRegistrationButton.addEventListener("click", () => {
  shelfForm.reset();
  fotoPronta = false;
  registerScreen.hidden = true;
  viewerScreen.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

cameraButton.addEventListener("click", () => {
  abrirCamera();
});
cameraVideo.addEventListener("loadedmetadata", () => { takePhotoButton.disabled = false; });
takePhotoButton.addEventListener("click", tirarFoto);
document.getElementById("cancelCameraButton").addEventListener("click", fecharCamera);
document.getElementById("closeCameraButton").addEventListener("click", fecharCamera);
cameraDialog.addEventListener("cancel", (evento) => {
  evento.preventDefault();
  fecharCamera();
});

shelfPhotoInput.addEventListener("change", () => {
  const arquivo = shelfPhotoInput.files?.[0];
  if (arquivo) abrirEditorDaFoto(arquivo);
});
[photoZoom, photoOffsetX, photoOffsetY].forEach((controle) => controle.addEventListener("input", atualizarPreviaEditor));
document.getElementById("usePhotoButton").addEventListener("click", confirmarEdicaoDaFoto);
document.getElementById("cancelEditorButton").addEventListener("click", cancelarEdicaoDaFoto);
document.getElementById("closeEditorButton").addEventListener("click", cancelarEdicaoDaFoto);
photoEditorDialog.addEventListener("cancel", (evento) => {
  evento.preventDefault();
  cancelarEdicaoDaFoto();
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
  if (!fotoPronta) {
    shelfNote.textContent = "Edite e confirme a foto antes de salvar a prateleira.";
    status.textContent = "A foto ainda precisa ser confirmada no editor.";
    return;
  }

  saveShelfButton.disabled = true;
  shelfNote.textContent = "Preparando e enviando a foto para o servidor…";
  status.textContent = "Salvando a prateleira no banco de dados…";
  status.classList.remove("erro");
  try {
    await cadastrarPrateleira(nome, foto);
    shelfForm.reset();
    fotoPronta = false;
    shelfNote.textContent = "Prateleira e foto salvas no banco de dados.";
    status.textContent = `Prateleira “${nome}” salva no servidor e selecionada.`;
    registerScreen.hidden = true;
    viewerScreen.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (erro) {
    shelfNote.textContent = erro.message || "Não foi possível salvar a foto no banco de dados.";
    status.textContent = `Falha ao salvar: ${shelfNote.textContent}`;
    status.classList.add("erro");
  } finally {
    saveShelfButton.disabled = false;
  }
});

carregarPrateleiras();

floorButtons.forEach((botao) => {
  botao.setAttribute("aria-pressed", "false");
  botao.addEventListener("click", () => {
    zoomPorId(botao.dataset.floor);
    fecharMenuLateral();
  });
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
  fecharMenuLateral();
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
