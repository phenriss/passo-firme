/* Passo Firme — lógica do app (sem dependências)
 *
 * Os programas de exercício (passaportes A, B, B+, C, C+, D e E-fit) seguem os
 * passaportes do projeto Vivifrail (© Mikel Izquierdo e equipe), reescritos aqui
 * com palavras próprias. Este app é independente e não oficial.
 */

/* ---------- Teste Vivifrail: pontuação (SPPB, 0 a 12) ---------- */

// lado: 10 s com os pés juntos? semi: 10 s em semi-tandem? tandem: 0, 1 (3-9 s) ou 2 (10 s)
function pontosEquilibrio(lado, semi, tandem) {
  if (!lado) return 0;
  let p = 1;
  if (semi) {
    p += 1;
    p += Math.max(0, Math.min(2, tandem || 0));
  }
  return p;
}

// segundos para andar 4 metros (menor de 3 tentativas); null = não consegue
function pontosMarcha(seg) {
  if (seg == null || !(seg > 0)) return 0;
  if (seg < 4.82) return 4;
  if (seg <= 6.2) return 3;
  if (seg <= 8.7) return 2;
  return 1;
}

// segundos para levantar da cadeira 5 vezes; null = não consegue
function pontosCadeira(seg) {
  if (seg == null || !(seg > 0)) return 0;
  if (seg <= 11.19) return 4;
  if (seg <= 13.69) return 3;
  if (seg <= 16.69) return 2;
  if (seg <= 59) return 1;
  return 0;
}

// 0-3 A · 4-6 B · 7-9 C · 10-12 D. O "+" (risco de queda) só existe para B e C.
function classificar(total, risco) {
  const letra = total <= 3 ? "A" : total <= 6 ? "B" : total <= 9 ? "C" : "D";
  const mais = !!risco && (letra === "B" || letra === "C");
  return { letra, mais, passaporte: letra + (mais ? "+" : "") };
}

/* ---------- Exercícios ---------- */

const GRUPOS = {
  forca: "Força",
  equilibrio: "Equilíbrio",
  marcha: "Caminhada",
  flex: "Alongamento",
};

function val(x, ctx) {
  return typeof x === "function" ? x(ctx) : x;
}

const EX = {
  bola: {
    id: "bola", g: "forca", nome: "Apertar uma bola",
    como: "Segure uma bola de borracha (ou antiestresse) e aperte devagar, com a maior força que conseguir. Depois solte. Terminadas as séries, repita com a outra mão.",
    dose: "3 séries de 12 com cada mão · 1 min de descanso entre as séries",
  },
  garrafa: {
    id: "garrafa", g: "forca", nome: "Levantar garrafas",
    como: "Sentado, com os braços esticados ao lado do corpo e uma garrafa com água em cada mão, dobre os cotovelos até as garrafas chegarem perto dos ombros.",
    dose: "3 séries de 12 · 1 min de descanso entre as séries",
    nota: (c) =>
      (c.p.garrafaMl ? "Garrafas com " + c.p.garrafaMl + " ml de água. " : "Defina a quantidade de água em Ajustes. ") +
      "Depois das séries deveria sobrar força para mais umas 12 repetições, com algum esforço. Se não fechar as séries, tire um pouco de água; se estiver fácil, ponha mais." +
      (c.semana >= 7 ? " Já passaram 6 semanas: vale refazer o ajuste do peso (veja em Ajustes)." : ""),
  },
  joelho: {
    id: "joelho", g: "forca", nome: "Esticar o joelho com caneleira",
    como: "Sentado numa cadeira, estique uma perna na horizontal, deixando-a o mais reta possível. Use uma caneleira de 500 g. Se com esse peso não fechar as 12 repetições, faça sem a caneleira.",
    dose: "3 séries de 12 com cada perna · 1 min de descanso entre as séries",
  },
  cadeiraAjuda: {
    id: "cadeiraAjuda", g: "forca", nome: "Levantar da cadeira com ajuda",
    como: "Sente numa cadeira firme, com uma pessoa à sua frente de braços estendidos. Com os pés bem apoiados, levante-se segurando nos braços dela, fique 1 segundo em pé e sente de novo, ainda segurando.",
    dose: "3 séries de 12 · 1 min de descanso entre as séries",
  },
  linha: {
    id: "linha", g: "equilibrio", nome: "Andar com os pés em linha",
    como: "Fique em pé perto de uma mesa, parede ou de um familiar. Dê passos curtos em linha reta, sempre encostando o calcanhar do pé da frente na ponta do outro pé.",
    dose: "3 séries de 15 passos · 30 s de descanso entre as séries",
  },
  sentarImaginario: {
    id: "sentarImaginario", g: "forca", nome: "Agachar como se fosse sentar",
    como: "Em pé, de frente para uma mesa, dobre quadris e joelhos como se fosse sentar e volte. Deixe uma cadeira atrás de você, por segurança.",
    dose: "3 séries de 12 · 1 min de descanso entre as séries",
  },
  pontasCalcanhares: {
    id: "pontasCalcanhares", g: "equilibrio", nome: "Andar nas pontas e nos calcanhares",
    como: "Em pé, apoiado numa mesa ou corrimão, ande 7 passos só na ponta dos pés. Pare um instante e ande mais 7 passos só nos calcanhares. Para dificultar: cruze os braços ou abra-os em cruz. Só feche os olhos se tiver alguém junto.",
    dose: "3 séries de 14 passos (7 + 7) · 1 min de descanso entre as séries",
  },
  alongBracosCadeira: {
    id: "alongBracosCadeira", g: "flex", nome: "Alongar os braços com a cadeira",
    como: "Sentado, afastado do encosto, com os braços soltos ao lado do corpo. Leve os braços para trás até segurar o encosto e incline o peito à frente até sentir tensão nos braços. Segure 10 segundos e relaxe 5 segundos, sem soltar o encosto.",
    dose: "3 séries de 3 repetições · 30 s de descanso entre as séries",
  },
  toalha: {
    id: "toalha", g: "forca", nome: "Torcer uma toalha",
    como: "Enrole uma toalha pequena, segure pelas duas pontas e faça o movimento de torcer uma toalha encharcada. Aperte devagar, o mais forte que puder, por 2 a 3 segundos.",
    dose: "3 séries de 12 · 1 min de descanso entre as séries",
  },
  cadeiraSozinho: {
    id: "cadeiraSozinho", g: "forca", nome: "Levantar da cadeira",
    como: "Numa cadeira firme com braços e com os pés bem apoiados, levante-se sem usar os braços. Fique 1 segundo em pé e sente de novo.",
    dose: "3 séries de 12 · 1 min de descanso entre as séries",
    nota: "Depois da primeira série, deveria dar para fazer mais umas 12 com algum esforço. Se não conseguir sem os braços, apoie só um; se ainda não der, use os dois.",
  },
  obstaculos: {
    id: "obstaculos", g: "equilibrio", nome: "Passar por cima de obstáculos",
    como: "Perto de uma mesa ou corrimão, cole uma fita adesiva no chão. Caminhe até a marca e passe por cima dela como se fosse um obstáculo de 15 cm. Use a mesa ou o corrimão de apoio quando precisar.",
    dose: "8 séries de 5 obstáculos · 1 min de descanso entre as séries",
  },
  oitos: {
    id: "oitos", g: "equilibrio", nome: "Andar fazendo oitos",
    como: "Coloque duas garrafas no chão, com pelo menos 1 metro entre elas, e ande desenhando um oito em volta delas. Ao terminar, pare 10 segundos em pé, sem sentar. Para dificultar: cruze os braços, mude o piso (areia, grama) ou feche os olhos, só com alguém junto.",
    dose: "3 séries de 2 voltas · 1 min de descanso entre as séries",
  },
  alongPernas: {
    id: "alongPernas", g: "flex", nome: "Alongar as pernas",
    como: "Sentado, estique uma perna com o calcanhar apoiado no chão e apoie as duas mãos no joelho da outra perna. Levante levemente a ponta do pé e incline o tronco à frente, até sentir tensão atrás da perna e na parte de baixo das costas. Segure 10 a 12 segundos e descanse 5.",
    dose: "3 séries de 6 repetições, alternando as pernas · 1 min de descanso entre as séries",
  },
  escadas: {
    id: "escadas", g: "forca", nome: "Subir e descer escadas",
    como: "Suba e desça escadas, no começo com a ajuda do corrimão. Quando se sentir confiante, pode soltar o corrimão ou até subir de dois em dois degraus.",
    dose: "3 séries de 20 degraus · 1 min de descanso entre as séries",
  },
  balao: {
    id: "balao", g: "equilibrio", nome: "Andar tocando um balão",
    como: "Caminhe em linha reta tocando um balão de uma mão para a outra.",
    dose: "2 séries de 10 passos · 30 s de descanso entre as séries",
  },
  umaPerna: {
    id: "umaPerna", g: "equilibrio", nome: "Equilíbrio em uma perna só",
    como: "Fique num pé só contando até 10; depois troque de perna. Para dificultar: cruze os braços ou abra-os em cruz, use uma superfície macia (como um tapete) ou feche os olhos, só com alguém junto.",
    dose: "5 repetições com cada perna",
  },
};

// Alongar os braços muda só o descanso entre séries
function alongBracos(descanso) {
  return {
    id: "alongBracos", g: "flex", nome: "Alongar os braços",
    como: "Sentado ou em pé, entrelace as mãos e estique os braços para cima, como se fosse tocar o teto. Segure 10 a 12 segundos e relaxe os braços por 5 segundos.",
    dose: "3 séries de 3 repetições · " + descanso + " de descanso entre as séries",
  };
}

// Exercícios de força com a barra (E-fit)
const ESFORCO_E = (c) =>
  c.semana <= 6
    ? "O peso deve permitir no máximo umas 20 repetições. Ao fim da última série, deveria dar para fazer mais 8 a 10: esforço “um pouco intenso”. Se sobrar muito mais, aumente o peso; se der menos de 8, reduza."
    : "O peso deve permitir no máximo umas 15 repetições. Ao fim da última série, deveria dar para fazer mais 6 a 8: esforço “um pouco intenso”. Se sobrar muito mais, aumente o peso; se der menos de 6, reduza.";

function barra(id, nome, como, extra) {
  return {
    id, g: "forca", nome,
    como: como + (extra ? " " + extra : ""),
    dose: "3 séries de 10 · 1 min de descanso entre as séries",
    nota: ESFORCO_E,
  };
}

const EX_BARRA = {
  biceps: barra("biceps", "Bíceps com a barra",
    "Em pé, coluna reta, joelhos levemente dobrados e pés na largura dos ombros. Segure a barra com as palmas para cima e, com os cotovelos junto ao corpo, dobre-os levando a barra até os ombros. Volte esticando os cotovelos."),
  remada: barra("remada", "Remada com a barra",
    "Segure a barra com as palmas para baixo. Em pé, joelhos levemente dobrados e tronco um pouco inclinado à frente, com a coluna reta e os braços esticados, suba a barra até tocar o peito e volte."),
  passadas: barra("passadas", "Passadas com a barra",
    "Em pé, com a barra apoiada nos ombros, atrás da cabeça, e pés na largura dos ombros. Dê uma passada à frente, com a coluna o mais reta possível, até a coxa da frente ficar paralela ao chão, sem encostar o joelho de trás no chão. Volte e alterne as pernas.",
    "Se tiver dificuldade para posicionar a barra, peça ajuda. O joelho da frente não deve passar da ponta do pé."),
  agachamento: barra("agachamento", "Agachamento com a barra",
    "Em pé, com a barra apoiada nos ombros, atrás da cabeça, e pés na largura dos ombros. Com a coluna reta, dobre os joelhos até as coxas ficarem paralelas ao chão e volte a esticar as pernas.",
    "Se tiver dificuldade para posicionar a barra, peça ajuda."),
};

/* ---------- Caminhada de cada passaporte ---------- */

const COMO_CAMINHAR =
  "Olhe para a frente, não para o chão. Apoie primeiro o calcanhar e depois os dedos. Ombros relaxados, braços balançando de leve.";
const RITMO_CONVERSA =
  " Use um ritmo em que dê para manter uma conversa sem parar, mas com um pouco de esforço.";

function caminhar(pas, c) {
  const s = c.semana;
  const base = { id: "caminhar", g: "marcha", nome: "Caminhar", fig: pas === "A" ? "caminharA" : pas === "E" ? "caminharE" : "caminhar" };
  switch (pas) {
    case "A":
      return {
        ...base, opcional: true, nome: "Caminhar (só quando a força melhorar)",
        como: "Levante da cadeira com ajuda de outra pessoa ou de um andador e ande no seu ritmo por 5 a 10 segundos. Pare, descanse e recomece. Só comece a caminhar depois de ganhar força nas pernas.",
        dose: "5 séries de 5 a 10 segundos · aumente aos poucos até 1 a 2 minutos seguidos",
      };
    case "B":
    case "B+":
      return {
        ...base,
        como: COMO_CAMINHAR + RITMO_CONVERSA + " Termine andando bem devagar por 2 minutos para relaxar.",
        dose: s <= 6
          ? "5 séries de 2 minutos (o passaporte aceita de 2 a 5) · 1 min de descanso entre as séries"
          : "3 séries de 8 minutos · 1 min de descanso entre as séries",
      };
    case "C":
    case "C+":
      return {
        ...base,
        como: COMO_CAMINHAR + RITMO_CONVERSA + " Termine andando bem devagar por 2 minutos para relaxar.",
        dose: s <= 6
          ? "3 séries de 10 minutos · 1 min de descanso entre as séries"
          : "3 séries de 15 minutos · 1 min de descanso entre as séries",
      };
    case "D":
      return {
        ...base,
        como: COMO_CAMINHAR + RITMO_CONVERSA + " Nas semanas 1 a 6, termine andando bem devagar por 2 minutos.",
        dose: s <= 6
          ? "3 séries de 10 minutos · 1 min de descanso entre as séries"
          : "30 a 45 minutos seguidos, sem parar",
      };
    case "E":
      return {
        ...base, nome: "Caminhar ou trotar",
        como: COMO_CAMINHAR + " O esforço deve ser “um pouco intenso”: o ritmo dificulta manter uma conversa fluida. Se andar estiver fácil, comece a trotar.",
        dose: s <= 6
          ? "3 séries de 15 minutos · 1 min de descanso entre as séries · nos últimos 5 minutos de cada série, acelere um pouco, até ficar difícil conversar"
          : "60 minutos seguidos · a cada 10 minutos, acelere por 3 minutos, até ficar difícil conversar",
      };
  }
}

/* ---------- Passaportes ---------- */

const PADRAO_ALTERNADO = ["C", "A", "C", "A", "C"]; // seg a sex: 3 dias de circuito
const PADRAO_QUATRO = ["C", "C", "A", "C", "C"];    // 4 dias de circuito
const PADRAO_TODOS = ["C", "C", "C", "C", "C"];

const PASSAPORTES = {
  A: {
    nome: "Tipo A · Incapacidade",
    quem: "Pessoa que não consegue levantar da cadeira sozinha ou está acamada. Rotina diária de uns 30 a 45 minutos.",
    padrao: PADRAO_TODOS,
    material: ["bola de borracha ou antiestresse", "2 garrafas de água", "caneleira de 500 g"],
    circuito: [EX.bola, EX.garrafa, EX.joelho, EX.cadeiraAjuda, EX.linha, alongBracos("30 s")],
  },
  B: {
    nome: "Tipo B · Fragilidade",
    quem: "Pessoa que anda com dificuldade ou com ajuda. 3 dias de circuito completo (sem ser em dias seguidos) e, nos outros, só caminhada.",
    padrao: PADRAO_ALTERNADO,
    material: ["bola de borracha ou antiestresse", "2 garrafas de água"],
    circuito: [EX.garrafa, EX.bola, EX.sentarImaginario, EX.pontasCalcanhares, EX.alongBracosCadeira, alongBracos("30 s")],
  },
  "B+": {
    nome: "Tipo B+ · Fragilidade e risco de quedas",
    quem: "Mesmos exercícios do tipo B, com 4 dias de circuito completo (sem ser em dias seguidos) e, no outro dia, só caminhada.",
    padrao: PADRAO_QUATRO,
    material: ["bola de borracha ou antiestresse", "2 garrafas de água"],
    circuito: [EX.garrafa, EX.bola, EX.sentarImaginario, EX.pontasCalcanhares, EX.alongBracosCadeira, alongBracos("30 s")],
    risco: true,
  },
  C: {
    nome: "Tipo C · Pré-fragilidade",
    quem: "Pessoa com pequenas dificuldades para andar, levantar ou no equilíbrio. 3 dias de circuito completo (sem ser em dias seguidos) e, nos outros, só caminhada.",
    padrao: PADRAO_ALTERNADO,
    material: ["2 garrafas de água", "1 toalha", "fita adesiva"],
    circuito: [EX.toalha, EX.garrafa, EX.cadeiraSozinho, EX.obstaculos, EX.oitos, EX.alongPernas, alongBracos("1 min")],
  },
  "C+": {
    nome: "Tipo C+ · Pré-fragilidade e risco de quedas",
    quem: "Mesmos exercícios do tipo C, com 4 dias de circuito completo (sem ser em dias seguidos) e, no outro dia, só caminhada.",
    padrao: PADRAO_QUATRO,
    material: ["2 garrafas de água", "1 toalha", "fita adesiva"],
    circuito: [EX.toalha, EX.garrafa, EX.cadeiraSozinho, EX.obstaculos, EX.oitos, EX.alongPernas, alongBracos("1 min")],
    risco: true,
  },
  D: {
    nome: "Tipo D · Robusto",
    quem: "Pessoa com pouca ou nenhuma limitação física. 3 dias de circuito completo (sem ser em dias seguidos) e, nos outros, só caminhada.",
    padrao: PADRAO_ALTERNADO,
    material: ["2 garrafas de água", "1 toalha", "1 balão"],
    circuito: [EX.toalha, EX.garrafa, EX.cadeiraSozinho, EX.escadas, EX.balao, EX.oitos, alongBracos("1 min"), EX.alongPernas],
  },
  E: {
    nome: "E-fit · Treino com barra",
    quem: "Programa mais avançado, com barra e pesos. 3 dias de circuito (sem ser em dias seguidos) e, nos outros, só caminhada ou trote. Na 1ª sessão da semana 1, descubra o peso certo da barra em cada exercício.",
    padrao: PADRAO_ALTERNADO,
    material: ["barra com pesos de até 30 kg", "1 balão"],
    circuito: [
      EX_BARRA.biceps, EX_BARRA.remada, EX_BARRA.passadas, EX_BARRA.agachamento,
      {
        ...EX.escadas,
        dose: (c) => (c.semana <= 6 ? "3" : "5") + " séries de 20 degraus · 1 min de descanso entre as séries",
        nota: "O ritmo deve dificultar a conversa e o esforço ser “um pouco intenso”. Se 20 degraus for fácil, pode subir para 30.",
      },
      { ...EX.balao, dose: "3 séries de 10 passos · 30 s de descanso entre as séries" },
      EX.umaPerna, EX.alongBracosCadeira, EX.alongPernas,
    ],
  },
};

const ORDEM_PASSAPORTES = ["A", "B", "B+", "C", "C+", "D", "E"];

const NOTA_RISCO =
  "Com risco de quedas, vale também revisar a casa (tapetes soltos, calçados, banheiro) e conversar com o médico sobre vitamina D, remédios e pressão.";

/* ---------- Plano do dia ---------- */

function parseData(str) {
  const [a, m, d] = str.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function segundaDaSemana(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// semana do programa (1 a 12 ou mais), contada de segunda a segunda
function semanaDoPrograma(inicioStr, data) {
  const ini = segundaDaSemana(parseData(inicioStr));
  const hoje = segundaDaSemana(data);
  const dias = Math.round((hoje - ini) / 86400000);
  return Math.max(1, Math.floor(dias / 7) + 1);
}

function resolver(ex, ctx) {
  return {
    id: ex.id, fig: ex.fig || ex.id, g: ex.g, nome: ex.nome, opcional: !!ex.opcional,
    como: val(ex.como, ctx),
    dose: val(ex.dose, ctx),
    nota: ex.nota ? val(ex.nota, ctx) : "",
  };
}

// data: objeto Date. Retorna { semana, descanso } ou { semana, tipo, itens }
function planoDoDia(p, data) {
  const pas = PASSAPORTES[p.passaporte];
  const semana = semanaDoPrograma(p.inicio, data);
  const dow = data.getDay();
  if (!pas || dow === 0 || dow === 6) return { semana, descanso: true, itens: [] };
  const tipo = pas.padrao[dow - 1];
  const ctx = { p, semana };
  const itens = [resolver(caminhar(p.passaporte, ctx), ctx)];
  if (tipo === "C") pas.circuito.forEach((e) => itens.push(resolver(e, ctx)));
  return { semana, tipo, itens };
}

function diaCompleto(p, data) {
  const pl = planoDoDia(p, data);
  if (pl.descanso) return false;
  const feitos = new Set(p.sessoes[hojeStr(data)] || []);
  return pl.itens.filter((i) => !i.opcional).every((i) => feitos.has(i.id));
}

/* ---------- Datas ---------- */

function hojeStr(d) {
  d = d || new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + dia;
}

function fmtData(str) {
  const [a, m, d] = str.split("-");
  return d + "/" + m + "/" + a;
}

function diasUteisDaSemana(d) {
  const seg = segundaDaSemana(d);
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(seg);
    x.setDate(seg.getDate() + i);
    return x;
  });
}

/* ---------- Estado e armazenamento ---------- */

const KEY = "passofirme.v1";

function migrar(s) {
  s.pessoas.forEach((p) => {
    p.sessoes = p.sessoes || {};
    p.esforco = p.esforco || {};
    p.avaliacoes = p.avaliacoes || [];
    if (!p.passaporte) p.inicio = p.inicio || null;
  });
  return s;
}

function carregar() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.pessoas)) return migrar(s);
  } catch (e) {}
  return { pessoas: [], ativa: null };
}

function salvar() {
  try {
    localStorage.setItem(KEY, JSON.stringify(estado));
  } catch (e) {}
}

function novoId() {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function pessoaAtiva() {
  return estado.pessoas.find((p) => p.id === estado.ativa) || null;
}

/* ---------- Interface ---------- */

let estado = typeof localStorage !== "undefined" ? carregar() : { pessoas: [], ativa: null };
let aba = "hoje";

function el(tag, attrs, ...filhos) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    if (k === "class") e.className = attrs[k];
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    e.append(f.nodeType ? f : document.createTextNode(f));
  }
  return e;
}

function renderPessoas() {
  const box = document.getElementById("pessoas");
  box.replaceChildren();
  estado.pessoas.forEach((p) => {
    box.append(
      el("button", {
        class: "chip" + (p.id === estado.ativa ? " ativo" : ""),
        onclick: () => {
          estado.ativa = p.id;
          salvar();
          render();
        },
      }, p.nome)
    );
  });
  box.append(el("button", { class: "chip novo", onclick: novaPessoa }, "+ Adicionar pessoa"));
}

function novaPessoa() {
  const nome = (prompt("Nome da pessoa:") || "").trim();
  if (!nome) return;
  const p = { id: novoId(), nome: nome.slice(0, 40), avaliacoes: [], sessoes: {}, esforco: {}, passaporte: null, inicio: null, garrafaMl: null };
  estado.pessoas.push(p);
  estado.ativa = p.id;
  aba = "avaliar";
  salvar();
  render();
}

function definirPassaporte(p, pass) {
  p.passaporte = pass;
  p.inicio = hojeStr();
  p.sessoes = {};
  p.esforco = {};
  salvar();
}

function removerPessoa() {
  const p = pessoaAtiva();
  if (!p) return;
  if (!confirm("Apagar " + p.nome + " e todo o histórico? Não dá para desfazer.")) return;
  estado.pessoas = estado.pessoas.filter((x) => x.id !== p.id);
  estado.ativa = estado.pessoas.length ? estado.pessoas[0].id : null;
  salvar();
  render();
}

// exercícios com a ficha aberta (para continuar aberta ao marcar outro item)
const abertos = new Set();

// vídeos reais/gerados: lista os ids disponíveis em videos/lista.json (vazia = só bonecos SVG)
let VIDEOS = new Set();
function carregarVideos() {
  fetch("videos/lista.json").then((r) => (r.ok ? r.json() : [])).then((l) => {
    if (Array.isArray(l) && l.length) { VIDEOS = new Set(l); render(); }
  }).catch(() => {});
}

function montarVideo(id, nome) {
  const v = el("video", { loop: "", muted: "", playsinline: "", preload: "metadata", controls: "", "aria-label": "Vídeo: " + nome });
  v.muted = true;
  v.addEventListener("error", () => { v.dataset.erro = "1"; });
  const src = "videos/" + id + ".mp4";
  v.src = src;
  const caixa = el("div", { class: "fig" }, v);
  caixa.fig = {
    start: () => { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); },
    stop: () => v.pause(),
  };
  return caixa;
}

function fichaExercicio(p, it) {
  const fig = VIDEOS.has(it.fig) ? montarVideo(it.fig, it.nome)
    : window.Figuras && Figuras.tem(it.fig) ? Figuras.montar(it.fig, it.nome) : null;
  const chave = p.id + ":" + it.id;
  const det = el("details", null,
    el("summary", null,
      el("small", null, GRUPOS[it.g] + (it.opcional ? " · opcional" : "")),
      el("strong", null, it.nome),
      el("span", null, it.dose)
    ),
    fig,
    el("p", null, it.como),
    it.nota ? el("p", { class: "nota" }, it.nota) : null
  );
  if (abertos.has(chave)) det.open = true;
  det.addEventListener("toggle", () => {
    if (det.open) abertos.add(chave); else abertos.delete(chave);
    if (fig) det.open ? fig.fig.start() : fig.fig.stop();
  });
  if (fig && det.open) fig.fig.start();
  return det;
}

function viewHoje(p) {
  if (!p.passaporte) {
    return el("div", { class: "card" },
      el("h2", null, "Vamos começar"),
      el("p", null, "Faça a avaliação de " + p.nome + " para descobrir o passaporte de exercícios. Se um profissional de saúde já indicou o passaporte, escolha ele direto."),
      el("button", { class: "btn", onclick: () => { aba = "avaliar"; render(); } }, "Ir para Avaliar")
    );
  }
  const pas = PASSAPORTES[p.passaporte];
  const agora = new Date();
  const hoje = hojeStr(agora);
  const plano = planoDoDia(p, agora);
  const semana = plano.semana;

  const topo = el("div", { class: "card nivel" },
    el("div", { class: "selo" }, p.passaporte === "E" ? "E" : p.passaporte),
    el("div", null,
      el("h2", null, pas.nome),
      el("p", { class: "mini" }, semana > 12 ? "Programa de 12 semanas concluído" : "Semana " + semana + " de 12"),
    )
  );

  // semana (seg a sex)
  const faixa = el("div", { class: "semana" });
  const nomes = ["Seg", "Ter", "Qua", "Qui", "Sex"];
  let ok = 0;
  diasUteisDaSemana(agora).forEach((d, i) => {
    const pl = planoDoDia(p, d);
    const feito = diaCompleto(p, d);
    if (feito) ok++;
    faixa.append(
      el("div", { class: "dia" + (feito ? " ok" : "") + (hojeStr(d) === hoje ? " hoje" : "") },
        el("span", null, nomes[i]),
        el("b", null, feito ? "✓" : pl.tipo === "C" ? "Circ." : "Andar")
      )
    );
  });
  const cartaoSemana = el("div", { class: "card" },
    el("h3", null, "Esta semana"),
    faixa,
    el("p", { class: "mini" }, ok + " de 5 dias completos")
  );

  const blocos = [topo];

  if (semana > 12) {
    blocos.push(el("div", { class: "card aviso-card" },
      el("strong", null, "As 12 semanas acabaram."),
      el("p", null, "Faça uma nova avaliação (aba Avaliar) para ver se o passaporte continua o mesmo.")
    ));
  }

  blocos.push(cartaoSemana);

  if (plano.descanso) {
    blocos.push(el("div", { class: "card" },
      el("h2", null, "Hoje é dia de descanso"),
      el("p", null, "O programa é de segunda a sexta. Aproveite para descansar e se mexer só no dia a dia.")
    ));
  } else {
    const feitos = new Set(p.sessoes[hoje] || []);
    const obrig = plano.itens.filter((i) => !i.opcional);
    const feitosObrig = obrig.filter((i) => feitos.has(i.id)).length;
    blocos.push(el("h3", { class: "tit" },
      (plano.tipo === "C" ? "Circuito de hoje" : "Hoje é dia de só caminhar") + " · " + feitosObrig + "/" + obrig.length));

    const lista = el("div", { class: "lista" });
    plano.itens.forEach((it) => {
      const marcado = feitos.has(it.id);
      lista.append(
        el("div", { class: "ex" + (marcado ? " feito" : "") },
          el("input", {
            type: "checkbox",
            "aria-label": "Marcar como feito: " + it.nome,
            checked: marcado ? "checked" : false,
            onchange: (e) => {
              const s = new Set(p.sessoes[hoje] || []);
              e.target.checked ? s.add(it.id) : s.delete(it.id);
              p.sessoes[hoje] = [...s];
              salvar();
              render();
            },
          }),
          fichaExercicio(p, it)
        )
      );
    });
    blocos.push(lista);

    blocos.push(el("div", { class: "card" },
      el("h3", null, "Material"),
      el("p", null, pas.material.join(" · "))
    ));
  }

  // esforço da semana
  const ESF = [["1", "Muito fácil"], ["2", "Um pouco difícil"], ["3", "Muito difícil"]];
  const atual = p.esforco[semana];
  const botoes = el("div", { class: "tres" });
  ESF.forEach(([v, rot]) =>
    botoes.append(
      el("button", {
        class: "opcao" + (atual === v ? " sel" : ""),
        onclick: () => { p.esforco[semana] = v; salvar(); render(); },
      }, rot)
    )
  );
  blocos.push(el("div", { class: "card" },
    el("h3", null, "Como foi esta semana?"),
    botoes,
    el("p", { class: "mini" }, "Se ficou muito fácil ou muito difícil, converse com o profissional que acompanha.")
  ));

  if (pas.risco) blocos.push(el("p", { class: "aviso" }, NOTA_RISCO));
  blocos.push(el("p", { class: "aviso" }, "Pare na hora se sentir dor, falta de ar, enjoo ou palpitação. Em caso de dúvida sobre algum exercício, fale com seu médico."));

  return el("div", null, ...blocos);
}

function viewAvaliar(p) {
  const wrap = el("div", null);

  // Antes de começar
  wrap.append(
    el("details", { class: "card" },
      el("summary", null, el("strong", null, "Antes de começar: fale com o médico se houver")),
      el("ul", { class: "lista-simples" },
        el("li", null, "infarto ou angina instável recente"),
        el("li", null, "arritmia ou pressão alta sem controle"),
        el("li", null, "queda de pressão ao levantar (hipotensão ortostática) sem controle"),
        el("li", null, "insuficiência cardíaca ou respiratória grave"),
        el("li", null, "diabetes descompensado ou com hipoglicemias frequentes"),
        el("li", null, "fratura no último mês (para os exercícios de força)"),
        el("li", null, "qualquer situação em que o médico não recomende exercício")
      ),
      el("p", { class: "mini" }, "O programa foi pensado para pessoas com 70 anos ou mais.")
    )
  );

  // Já tenho o passaporte
  const sel = el("select", { name: "passaporte", "aria-label": "Passaporte" });
  ORDEM_PASSAPORTES.forEach((k) =>
    sel.append(el("option", { value: k, selected: p.passaporte === k ? "selected" : false }, PASSAPORTES[k].nome))
  );
  wrap.append(
    el("div", { class: "card" },
      el("h2", null, "Já sei o passaporte"),
      el("p", { class: "mini" }, "Use se um profissional de saúde já indicou o passaporte de " + p.nome + "."),
      el("label", { class: "campo" }, "Passaporte", sel),
      el("button", {
        class: "btn",
        onclick: () => {
          if (p.passaporte && !confirm("Isso reinicia o programa na semana 1 e apaga as marcações. Continuar?")) return;
          definirPassaporte(p, sel.value);
          aba = "hoje";
          render();
        },
      }, "Usar este passaporte")
    )
  );

  // Teste
  const f = el("form", { class: "card form" });
  f.append(
    el("h2", null, "Fazer o teste com " + p.nome),
    el("p", { class: "mini" }, "Faça os testes com alguém ao lado, em local seguro. Os pontos são calculados sozinhos.")
  );

  f.append(el("h3", null, "1. Equilíbrio"));
  f.append(
    el("label", { class: "linha" }, el("input", { type: "checkbox", name: "lado" }), "Fica 10 s com os pés juntos, lado a lado"),
    el("label", { class: "linha" }, el("input", { type: "checkbox", name: "semi" }), "Fica 10 s com o calcanhar de um pé ao lado do dedão do outro (semi-tandem)"),
    el("label", { class: "campo" }, "Calcanhar de um pé encostado na ponta do outro (tandem)",
      el("select", { name: "tandem" },
        el("option", { value: "0" }, "Menos de 3 segundos"),
        el("option", { value: "1" }, "De 3 a 9 segundos"),
        el("option", { value: "2" }, "10 segundos ou mais")
      )
    )
  );

  f.append(
    el("h3", null, "2. Caminhar 4 metros"),
    el("label", { class: "campo" }, "Menor tempo em segundos (3 tentativas, passo normal)",
      el("input", { type: "number", name: "marcha", step: "0.01", min: "0", inputmode: "decimal", placeholder: "ex.: 5,5" })
    ),
    el("label", { class: "linha" }, el("input", { type: "checkbox", name: "marchaNao" }), "Não consegue fazer")
  );

  f.append(
    el("h3", null, "3. Levantar da cadeira 5 vezes"),
    el("label", { class: "campo" }, "Tempo em segundos (o mais rápido possível, braços cruzados no peito)",
      el("input", { type: "number", name: "cadeira", step: "0.01", min: "0", inputmode: "decimal", placeholder: "ex.: 13" })
    ),
    el("label", { class: "linha" }, el("input", { type: "checkbox", name: "cadeiraNao" }), "Não consegue fazer")
  );

  f.append(
    el("h3", null, "4. Risco de quedas"),
    el("p", { class: "mini" }, "Marque se alguma das situações vale para a pessoa."),
    el("label", { class: "linha" }, el("input", { type: "checkbox", name: "r1" }), "2 ou mais quedas no último ano, ou 1 queda que precisou de atendimento médico"),
    el("label", { class: "linha" }, el("input", { type: "checkbox", name: "r2" }), "Levou mais de 20 s para levantar da cadeira sem usar os braços, andar 3 m, dar a volta e sentar de novo"),
    el("label", { class: "linha" }, el("input", { type: "checkbox", name: "r3" }), "Levou mais de 7,5 s para andar 6 m em passo normal (vale o menor de 2 tempos)"),
    el("label", { class: "linha" }, el("input", { type: "checkbox", name: "r4" }), "Tem diagnóstico de deterioração cognitiva")
  );

  f.append(el("button", { class: "btn", type: "submit" }, "Calcular passaporte"));

  f.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const d = new FormData(f);
    const num = (n) => {
      const v = parseFloat(String(d.get(n) || "").replace(",", "."));
      return isNaN(v) ? null : v;
    };
    const marchaSeg = d.get("marchaNao") ? null : num("marcha");
    const cadeiraSeg = d.get("cadeiraNao") ? null : num("cadeira");
    if (!d.get("marchaNao") && marchaSeg == null) return alert("Preencha o tempo da caminhada ou marque 'Não consegue fazer'.");
    if (!d.get("cadeiraNao") && cadeiraSeg == null) return alert("Preencha o tempo da cadeira ou marque 'Não consegue fazer'.");

    const eq = pontosEquilibrio(!!d.get("lado"), !!d.get("semi"), parseInt(d.get("tandem"), 10));
    const ma = pontosMarcha(marchaSeg);
    const ca = pontosCadeira(cadeiraSeg);
    const total = eq + ma + ca;
    const risco = !!(d.get("r1") || d.get("r2") || d.get("r3") || d.get("r4"));
    const cls = classificar(total, risco);

    if (p.passaporte && !confirm("O resultado é " + PASSAPORTES[cls.passaporte].nome + ". Isso reinicia o programa na semana 1 e apaga as marcações. Continuar?")) return;

    p.avaliacoes.push({ data: hojeStr(), eq, ma, ca, total, risco, passaporte: cls.passaporte });
    definirPassaporte(p, cls.passaporte);
    aba = "hoje";
    render();
  });
  wrap.append(f);

  return wrap;
}

function viewAjustes(p) {
  const wrap = el("div", null);

  // Garrafas
  const ml = el("input", { type: "number", name: "ml", min: "0", step: "10", inputmode: "numeric", placeholder: "ex.: 400", value: p.garrafaMl || "" });
  wrap.append(
    el("div", { class: "card" },
      el("h3", null, "Água nas garrafas"),
      el("p", { class: "mini" }, "Encha 2 garrafas de 500 ml e veja se a pessoa consegue fazer cerca de 30 repetições de “Levantar garrafas” com algum esforço. Ajuste a água até chegar nisso e anote a quantidade. Depois de 6 semanas, refaça o ajuste."),
      el("label", { class: "campo" }, "Água em cada garrafa (ml)", ml),
      el("button", {
        class: "btn",
        onclick: () => {
          const v = parseInt(ml.value, 10);
          p.garrafaMl = v > 0 ? v : null;
          salvar();
          alert("Anotado.");
        },
      }, "Salvar")
    )
  );

  // Passaporte
  if (p.passaporte) {
    wrap.append(
      el("div", { class: "card" },
        el("h3", null, "Programa"),
        el("p", null, PASSAPORTES[p.passaporte].nome + (p.inicio ? " · começou em " + fmtData(p.inicio) : "")),
        el("button", {
          class: "btn sec",
          onclick: () => {
            if (!confirm("Recomeçar o programa hoje, na semana 1? As marcações atuais serão apagadas.")) return;
            p.inicio = hojeStr();
            p.sessoes = {};
            p.esforco = {};
            salvar();
            aba = "hoje";
            render();
          },
        }, "Recomeçar o programa hoje")
      )
    );
  }

  // Histórico
  wrap.append(el("h3", { class: "tit" }, "Avaliações"));
  if (!p.avaliacoes.length) wrap.append(el("div", { class: "card" }, el("p", null, "Ainda não há avaliações.")));
  p.avaliacoes.slice().reverse().forEach((a) => {
    wrap.append(
      el("div", { class: "card hist" },
        el("div", { class: "selo peq" }, a.passaporte || a.letra),
        el("div", null,
          el("strong", null, fmtData(a.data) + " · " + a.total + " de 12 pontos"),
          el("p", { class: "mini" }, "Equilíbrio " + a.eq + " · Caminhada " + a.ma + " · Cadeira " + a.ca + (a.risco || a.quedas ? " · risco de quedas" : ""))
        )
      )
    );
  });
  if (p.avaliacoes.length) wrap.append(el("p", { class: "mini" }, "Refaça a avaliação ao fim das 12 semanas para ver a evolução."));

  wrap.append(el("button", { class: "btn perigo", onclick: removerPessoa }, "Apagar " + p.nome));
  return wrap;
}

function avisoGeral() {
  return el("p", { class: "aviso" },
    "Passo Firme é um app independente e não oficial. Os programas seguem os passaportes de exercício do projeto Vivifrail (© Mikel Izquierdo), reescritos com palavras próprias; o material completo, com imagens, está em vivifrail.com. Este app não substitui avaliação de médico, fisioterapeuta ou educador físico. Os dados ficam só neste aparelho."
  );
}

let ultimaVista = "";

function render() {
  const yAntes = window.scrollY;
  renderPessoas();
  const main = document.getElementById("conteudo");
  main.replaceChildren();
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("ativo", b.dataset.aba === aba));

  const p = pessoaAtiva();
  if (!p) {
    main.append(
      el("div", { class: "card" },
        el("h2", null, "Bem-vindo ao Passo Firme"),
        el("p", null, "Acompanhe os exercícios do passaporte Vivifrail para manter força e equilíbrio na terceira idade."),
        el("button", { class: "btn", onclick: novaPessoa }, "Adicionar a primeira pessoa")
      ),
      avisoGeral()
    );
    return;
  }
  const views = { hoje: viewHoje, avaliar: viewAvaliar, ajustes: viewAjustes };
  main.append(views[aba](p));
  if (aba !== "hoje") main.append(avisoGeral());
  const vista = aba + ":" + p.id;
  window.scrollTo(0, vista === ultimaVista ? yAntes : 0);
  ultimaVista = vista;
}

if (typeof document !== "undefined") {
  document.querySelectorAll("nav button").forEach((b) =>
    b.addEventListener("click", () => {
      aba = b.dataset.aba;
      render();
    })
  );
  if (!estado.ativa && estado.pessoas.length) estado.ativa = estado.pessoas[0].id;
  render();
  carregarVideos();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

if (typeof module !== "undefined") {
  module.exports = {
    pontosEquilibrio, pontosMarcha, pontosCadeira, classificar,
    PASSAPORTES, ORDEM_PASSAPORTES, planoDoDia, diaCompleto, semanaDoPrograma, hojeStr, parseData,
  };
}
