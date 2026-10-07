/* Passo Firme — bonecos vetoriais animados (SVG puro, sem dependências).
 *
 * Um esqueleto 2D (vista lateral, olhando para a direita) é montado a partir
 * de poses-chave. Cada exercício é só uma tabela de poses (ou uma função que
 * gera a pose a cada instante), e o mesmo motor faz a transição suave.
 *
 * Convenções:
 *  - ângulos em graus, medidos a partir da vertical para baixo; positivo = para a frente
 *  - braços/pernas "fk": [ângulo do osso de cima, flexão da articulação]
 *  - braços "ik": [x do alvo, altura do alvo acima do chão]
 *  - pernas "ik": [x do tornozelo, elevação do pé, ângulo do pé]
 */
(function (root) {
  "use strict";

  const G = 200, W = 320, H = 220, CX = 150;
  const D = { thigh: 38, shin: 38, torso: 40, neck: 5, head: 9, uarm: 24, farm: 22 };

  const C = {
    fundo: "#eef6f4", chao: "#d5e4df", linha: "#b5c9c3", marca: "#c4d4cf",
    camisa: "#0f6b5c", camisaF: "#5fa899",
    calca: "#34495e", calcaF: "#8294a6",
    pele: "#f0c7a0", peleEsc: "#d9a982", cabelo: "#b9c1c5",
    sapato: "#1f2d2a", sapatoF: "#66746f",
    madeira: "#c19a6b", madeiraEsc: "#9a7550",
    metal: "#546e7a", metalEsc: "#263238",
    agua: "#4fa3e0", tampa: "#2c5f8a", bola: "#e8832a", balao: "#e5484d",
    toalha: "#e9a8b8", toalhaEsc: "#c97b92", fita: "#f2b705",
    ajuda: "#c46a1a", ajudaF: "#dba06a",
  };

  const rad = (d) => (d * Math.PI) / 180;
  const f1 = (n) => Math.round(n * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /* ---------- geometria ---------- */

  // pé: calcanhar e ponta em relação ao tornozelo, girados pelo ângulo do pé
  function foot(phi) {
    const c = Math.cos(rad(phi)), s = Math.sin(rad(phi));
    const r = (x, y) => [x * c - y * s, x * s + y * c];
    const heel = r(-5, 6), toe = r(11, 6);
    return { heel, toe, phi, d: Math.max(heel[1], toe[1]) };
  }

  // duas juntas: devolve a articulação do meio (cotovelo/joelho) e a ponta alcançada
  function ik2(ax, ay, tx, ty, l1, l2, sign) {
    let dx = tx - ax, dy = ty - ay, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-6) { dx = 0; dy = 1; d = 1; }
    const dc = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
    const ux = dx / d, uy = dy / d;
    const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return {
      j: [ax + ux * a + sign * h * -uy, ay + uy * a + sign * h * ux],
      e: [ax + ux * dc, ay + uy * dc],
    };
  }

  const BASE = {
    hx: CX, hh: null, lean: 0, head: 0,
    an: [4, 8], af: [10, 10],
    ln: [0, 0, 0], lf: [-4, 4, 0],
    k: 0,
  };

  function solve(p, m) {
    m = m || {};
    const fn = foot(p.ln[2]), ff = foot(p.lf[2]);
    const legIk = m.ln === "ik" || m.lf === "ik";
    const hx = p.hx;
    let hy;
    if (p.hh != null) hy = G - p.hh;
    else if (legIk) hy = G - 80;
    else {
      const rel = (l) => {
        const a = rad(l[0]), b = rad(l[0] - l[1]);
        return D.thigh * Math.cos(a) + D.shin * Math.cos(b);
      };
      hy = G - Math.max(rel(p.ln) + fn.d, rel(p.lf) + ff.d);
    }
    const leg = (l, mode, fo) => {
      let knee, ank;
      if (mode === "ik") {
        const r = ik2(hx, hy, l[0], G - l[1] - fo.d, D.thigh, D.shin, -1);
        knee = r.j; ank = r.e;
      } else {
        const a = rad(l[0]), b = rad(l[0] - l[1]);
        knee = [hx + D.thigh * Math.sin(a), hy + D.thigh * Math.cos(a)];
        ank = [knee[0] + D.shin * Math.sin(b), knee[1] + D.shin * Math.cos(b)];
      }
      return {
        knee, ank,
        heel: [ank[0] + fo.heel[0], ank[1] + fo.heel[1]],
        toe: [ank[0] + fo.toe[0], ank[1] + fo.toe[1]],
        phi: fo.phi,
      };
    };
    const lean = rad(p.lean);
    const sh = [hx + D.torso * Math.sin(lean), hy - D.torso * Math.cos(lean)];
    const arm = (a, mode) => {
      let el, wr;
      if (mode === "ik" || mode === "ikr") {
        const r = ik2(sh[0], sh[1], a[0], G - a[1], D.uarm, D.farm, mode === "ik" ? 1 : -1);
        el = r.j; wr = r.e;
      } else {
        const a1 = rad(a[0]), a2 = rad(a[0] + a[1]);
        el = [sh[0] + D.uarm * Math.sin(a1), sh[1] + D.uarm * Math.cos(a1)];
        wr = [el[0] + D.farm * Math.sin(a2), el[1] + D.farm * Math.cos(a2)];
      }
      return { el, wr, ang: (Math.atan2(wr[0] - el[0], wr[1] - el[1]) * 180) / Math.PI };
    };
    const hd = rad(p.lean + p.head);
    const hc = [sh[0] + (D.neck + D.head) * Math.sin(hd), sh[1] - (D.neck + D.head) * Math.cos(hd)];
    return {
      hip: [hx, hy], sh, hc, lean: p.lean, hd: p.lean + p.head,
      ln: leg(p.ln, m.ln, fn), lf: leg(p.lf, m.lf, ff),
      an: arm(p.an, m.an), af: arm(p.af, m.af),
    };
  }

  /* ---------- desenho ---------- */

  const pt = (p) => f1(p[0]) + "," + f1(p[1]);
  const pl = (pts, w, col) =>
    '<polyline points="' + pts.map(pt).join(" ") + '" fill="none" stroke="' + col +
    '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
  const line = (x1, y1, x2, y2, w, col) =>
    '<line x1="' + f1(x1) + '" y1="' + f1(y1) + '" x2="' + f1(x2) + '" y2="' + f1(y2) +
    '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  const circ = (x, y, r, fill, stroke, sw) =>
    '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(r) + '" fill="' + fill + '"' +
    (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw || 1) + '"' : "") + "/>";
  const rect = (x, y, w, h, rx, fill, stroke) =>
    '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) +
    '" rx="' + (rx || 0) + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="1.2"' : "") + "/>";

  /* ---- anatomia: contornos com volume (coxa, panturrilha, braço...) ---- */

  const LUZ = [0.62, -0.78]; // luz vem da frente e de cima
  const mixc = (c1, c2, t) => {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16));
    const a = p(c1), b = p(c2);
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };

  // membro com perfil de raio variável: rs = [[t, raio], ...] com t de 0 a 1
  function membro(a, b, rs, fill, o) {
    o = o || {};
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (nx * LUZ[0] + ny * LUZ[1] < 0) { nx = -nx; ny = -ny; } // n aponta para o lado iluminado
    const P = (t, k) => {
      const r = rs.find((q, i) => i === rs.length - 1 || t <= rs[i + 1][0]);
      let i = 0; while (i < rs.length - 2 && t > rs[i + 1][0]) i++;
      const [t0, r0] = rs[i], [t1, r1] = rs[Math.min(i + 1, rs.length - 1)];
      const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0, uu = u * u * (3 - 2 * u);
      const rr = (r0 + (r1 - r0) * uu) * k;
      return [a[0] + dx * t + nx * rr, a[1] + dy * t + ny * rr];
    };
    const N = 9, ts = [];
    for (let i = 0; i <= N; i++) ts.push(i / N);
    const luz = ts.map((t) => P(t, 1)), som = ts.map((t) => P(t, -1));
    const poly = (pts) => pts.map(pt).join(" ");
    let out = '<polygon points="' + poly(luz.concat(som.slice().reverse())) + '" fill="' + fill + '" stroke="' + fill + '" stroke-width=".6" stroke-linejoin="round"/>';
    out += circ(a[0], a[1], rs[0][1], fill) + circ(b[0], b[1], rs[rs.length - 1][1], fill);
    if (!o.plano) {
      // sombra do lado oposto à luz e brilho do lado da luz
      const meio = ts.map((t) => P(t, -0.25));
      out += '<polygon points="' + poly(meio.concat(som.slice().reverse())) + '" fill="' + mixc(fill, "#000000", 0.32) + '" fill-opacity=".55"/>';
      const b1 = ts.map((t) => P(t, 0.78)), b2 = ts.map((t) => P(t, 0.3));
      out += '<polygon points="' + poly(b1.concat(b2.reverse())) + '" fill="#ffffff" fill-opacity="' + (o.brilho == null ? 0.14 : o.brilho) + '"/>';
    }
    return out;
  }

  const COXA = [[0, 8.4], [0.35, 7.9], [0.8, 6], [1, 5.2]];
  const CANELA = [[0, 5.2], [0.28, 5.7], [0.7, 4.2], [1, 3.4]];
  const BRACO = [[0, 5], [0.45, 4.6], [1, 3.9]];
  const ANTEB = [[0, 3.7], [0.35, 3.8], [1, 2.7]];

  // tronco (vista lateral): costas, peito, barriga, ombro arredondado
  function tronco(J, fill) {
    const u = [J.sh[0] - J.hip[0], J.sh[1] - J.hip[1]];
    const len = Math.sqrt(u[0] * u[0] + u[1] * u[1]) || 1;
    const ux = u[0] / len, uy = u[1] / len, fx = -uy, fy = ux;
    const at = (t, back, front) => [
      [J.hip[0] + u[0] * t - fx * back, J.hip[1] + u[1] * t - fy * back],
      [J.hip[0] + u[0] * t + fx * front, J.hip[1] + u[1] * t + fy * front],
    ];
    const P = [at(-0.04, 9.2, 8.6), at(0.22, 8.4, 9.4), at(0.45, 8.6, 10.4), at(0.7, 9.8, 11.2), at(0.92, 8.8, 8.2), at(1.02, 5.6, 5.6)];
    let d = "M" + pt(P[0][0]);
    for (let i = 1; i < P.length; i++) d += "L" + pt(P[i][0]);
    for (let i = P.length - 1; i >= 0; i--) d += "L" + pt(P[i][1]);
    const sombra = at(0.5, 9.5, -1);
    let o = '<path d="' + d + 'Z" fill="' + fill + '" stroke="' + fill + '" stroke-width="3.2" stroke-linejoin="round"/>';
    // sombra nas costas e brilho no peito
    let d2 = "M" + pt(P[0][0]);
    for (let i = 1; i < P.length; i++) d2 += "L" + pt(P[i][0]);
    const back = P.map((q, i) => at([-0.04, 0.22, 0.45, 0.7, 0.92, 1.02][i], 0.0, 0)[0]);
    for (let i = P.length - 1; i >= 0; i--) d2 += "L" + pt(back[i]);
    o += '<path d="' + d2 + 'Z" fill="' + mixc(fill, "#000000", 0.3) + '" fill-opacity=".45"/>';
    const br = [at(0.55, 0, 6.5)[1], at(0.78, 0, 9.4)[1], at(0.86, 0, 7)[1], at(0.78, 0, 4.2)[1], at(0.55, 0, 3)[1]];
    o += '<polygon points="' + br.map(pt).join(" ") + '" fill="#fff" fill-opacity=".1"/>';
    // bainha da camisa
    const h = at(0.04, 9.4, 9.2);
    o += line(h[0][0], h[0][1], h[1][0], h[1][1], 1.2, mixc(fill, "#000000", 0.35));
    return o;
  }

  function mao(wr, ang, cor, esc) {
    return (
      '<g transform="translate(' + f1(wr[0]) + " " + f1(wr[1]) + ") rotate(" + f1(-ang) + ')">' +
      '<ellipse cx="0" cy="2.6" rx="3.1" ry="3.6" fill="' + cor + '"/>' +
      '<ellipse cx="0.6" cy="6.2" rx="2.4" ry="3.1" fill="' + cor + '"/>' +
      '<ellipse cx="2.9" cy="3" rx="1.25" ry="2.5" transform="rotate(-18 2.9 3)" fill="' + cor + '"/>' +
      '<path d="M-0.6 6.4 L-0.4 8.8 M1.2 6.6 L1.4 8.9" stroke="' + esc + '" stroke-width=".5" stroke-linecap="round" fill="none"/>' +
      "</g>"
    );
  }

  function tenis(L, frente) {
    const corpo = frente ? "#f6f8f7" : "#c3ccc9";
    const detalhe = frente ? "#0f6b5c" : "#4d7d73";
    const sola = frente ? "#26332f" : "#56635f";
    return (
      '<g transform="translate(' + f1(L.ank[0]) + " " + f1(L.ank[1]) + ") rotate(" + f1(L.phi) + ')">' +
      '<path d="M-5.2 -4.5 L-6.2 2 Q-7.6 5.2 -5.2 6.4 L11.6 6.4 Q15.4 6.2 14.8 3.6 Q14 1.2 9.2 0.2 L3.8 -1.4 L3.2 -4.5 Z" fill="' + corpo + '"/>' +
      '<path d="M-6.6 5 L14.9 5 L15 6.9 Q14.6 7.8 12 7.8 L-5.4 7.8 Q-7.4 7.4 -6.6 5 Z" fill="' + sola + '"/>' +
      '<path d="M3.8 -1.4 L8.6 0.6 M2 1 L6.8 2.6 M0 3 L4.8 4.4" stroke="' + detalhe + '" stroke-width=".9" stroke-linecap="round" fill="none"/>' +
      "</g>"
    );
  }

  // cabeça de perfil, em coordenadas locais (olhando para a direita)
  function cabeca(J) {
    return (
      '<g transform="translate(' + f1(J.hc[0]) + " " + f1(J.hc[1]) + ") rotate(" + f1(J.hd) + ')">' +
      // cabelo de trás + coque
      '<path d="M-7.5 -2 C-10 -8 -3 -12.4 4 -10.2 C-1 -8 -5 -4 -4 4 C-5.5 6 -8 4 -7.5 -2 Z" fill="' + mixc(C.cabelo, "#000000", 0.18) + '"/>' +
      '<circle cx="-9.2" cy="2.4" r="4.4" fill="' + mixc(C.cabelo, "#000000", 0.12) + '"/>' +
      // rosto de perfil
      '<path d="M-6 -4 C-6 -9.5 1 -10.6 4.2 -9 C7 -7.6 7.8 -5.2 7.7 -3.2 L8.2 -1 L10.7 2.2 L8.6 3.5 L8.7 4.7 L8.2 5.9 L7.6 7.7 L5.6 9.3 C2 10.6 -3 9.6 -5.6 6 C-7.4 2.6 -7 -1 -6 -4 Z" fill="' + C.pele + '"/>' +
      '<path d="M2 9.8 C-2 10.5 -5.4 8 -6 4 C-3 8 1 8 5.6 9.3 Z" fill="' + C.peleEsc + '" fill-opacity=".5"/>' +
      // cabelo da frente
      '<path d="M-6.4 -3 C-7 -9.8 2.2 -11.8 6.6 -7.4 C4.8 -7.6 2.4 -6.6 0.6 -4.4 C-1.4 -6.4 -4 -6 -6.4 -3 Z" fill="' + C.cabelo + '"/>' +
      '<path d="M-2 -9.4 Q1.5 -9.6 4 -8.4" stroke="#fff" stroke-opacity=".35" stroke-width="1" fill="none" stroke-linecap="round"/>' +
      // orelha
      '<ellipse cx="-1.4" cy="1.8" rx="1.9" ry="2.7" fill="' + C.peleEsc + '"/><path d="M-1.8 0.8 Q-0.8 1.6 -1.6 3" stroke="#b78b69" stroke-width=".5" fill="none"/>' +
      // sobrancelha, olho, óculos
      '<path d="M3 -3.5 Q5 -4.5 7 -3.7" stroke="#8d99a0" stroke-width="1" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="5" cy="-1.5" rx="1.25" ry="0.95" fill="#fff"/><circle cx="5.4" cy="-1.5" r=".8" fill="#2b2623"/>' +
      '<path d="M3.7 -2.4 Q5 -3 6.5 -2.4" stroke="#b78b69" stroke-width=".5" fill="none"/>' +
      '<rect x="2.4" y="-4" width="6" height="5" rx="2.2" fill="#9fd3e6" fill-opacity=".22" stroke="#3b4a54" stroke-width=".7"/>' +
      '<path d="M2.4 -2 L-2 0.8" stroke="#3b4a54" stroke-width=".6" fill="none"/>' +
      // bochecha e boca
      '<circle cx="4" cy="3.4" r="2" fill="#f2a08e" fill-opacity=".32"/>' +
      '<path d="M5.8 5.9 Q7.4 6.5 8.4 5.8" stroke="#a8584b" stroke-width=".9" stroke-linecap="round" fill="none"/>' +
      '<path d="M8.2 3.4 L9.4 3.2" stroke="#c28f74" stroke-width=".5" fill="none"/>' +
      "</g>"
    );
  }

  function figura(J, pal) {
    pal = pal || { camisa: C.camisa, camisaF: C.camisaF };
    const manga = (a, b, c) => b;
    let s = "";
    // --- lado de trás (mais escuro) ---
    s += membro(J.hip, J.lf.knee, COXA, C.calcaF, { brilho: 0.06 }) + membro(J.lf.knee, J.lf.ank, CANELA, C.calcaF, { brilho: 0.06 });
    s += tenis(J.lf, false);
    s += membro(J.af.el, J.af.wr, ANTEB, C.peleEsc, { plano: true });
    s += mao(J.af.wr, J.af.ang, C.peleEsc, "#b78b69");
    s += membro(J.sh, J.af.el, BRACO, pal.camisaF, { brilho: 0.08 });
    // --- quadril, tronco, pescoço ---
    s += circ(J.hip[0], J.hip[1], 9, C.calca);
    s += tronco(J, pal.camisa);
    const nk = [J.sh[0] * 0.3 + J.hc[0] * 0.7, J.sh[1] * 0.3 + J.hc[1] * 0.7];
    s += membro(J.sh, nk, [[0, 4.2], [1, 3.4]], C.pele);
    s += '<path d="M' + pt([J.sh[0] - 2, J.sh[1] + 1]) + " Q" + pt([J.sh[0] + 4, J.sh[1] + 5]) + " " + pt([J.sh[0] + 6.5, J.sh[1] - 1.5]) + '" stroke="' + mixc(pal.camisa, "#000000", 0.25) + '" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
    s += cabeca(J);
    // --- lado da frente ---
    s += membro(J.hip, J.ln.knee, COXA, C.calca) + membro(J.ln.knee, J.ln.ank, CANELA, C.calca);
    s += line(J.ln.knee[0], J.ln.knee[1], J.ln.knee[0] + 1.5 * Math.sign(J.ln.ank[0] - J.ln.knee[0] || 1), J.ln.knee[1] + 1, 0.1, "none");
    s += tenis(J.ln, true);
    s += membro(J.an.el, J.an.wr, ANTEB, C.pele, { plano: true });
    s += mao(J.an.wr, J.an.ang, C.pele, "#b78b69");
    s += membro(J.sh, J.an.el, BRACO, pal.camisa);
    return s;
  }

  /* ---------- cenário ---------- */

  function chao(off, sp) {
    let s = "";
    if (sp) {
      const o = ((off % sp) + sp) % sp;
      for (let x = -o; x < W + sp; x += sp) s += rect(x, G + 9, 11, 2.2, 1, C.marca);
    }
    return s;
  }

  function cadeira(x0, w, o) {
    o = o || {};
    const sy = G - 36;
    let s = "";
    s += line(x0 + 2, sy, x0 + 2, sy - (o.costas || 58), 4.5, C.madeiraEsc);
    if (o.bracos) {
      const bx = x0 + w * 0.62;
      s += line(x0 + 2, sy - 22, bx, sy - 22, 4, C.madeiraEsc);
      s += line(bx, sy - 22, bx, sy, 4, C.madeiraEsc);
    }
    s += line(x0 + 4, sy + 4, x0 + 4, G, 4, C.madeiraEsc);
    s += line(x0 + w - 5, sy + 4, x0 + w - 5, G, 4, C.madeiraEsc);
    s += rect(x0, sy, w, 5.5, 2.5, C.madeira);
    return s;
  }

  function mesa(x0, x1, topo) {
    const y = G - topo;
    return (
      line(x0 + 7, y + 5, x0 + 7, G, 4, C.madeiraEsc) +
      line(x1 - 7, y + 5, x1 - 7, G, 4, C.madeiraEsc) +
      rect(x0, y, x1 - x0, 6, 2.5, C.madeira)
    );
  }

  function garrafa(wr, ang, nivel) {
    const g = '<g transform="translate(' + f1(wr[0]) + " " + f1(wr[1]) + ") rotate(" + f1(-ang) + ')">';
    return (
      g +
      rect(-4.5, -3, 9, 22, 3.2, "#dcecf7", "#7fb3d6") +
      rect(-4.5, 19 - 22 * (nivel || 0.6), 9, 22 * (nivel || 0.6) - 3, 2.5, C.agua) +
      rect(-2.8, 19, 5.6, 3.5, 1, C.tampa) +
      "</g>"
    );
  }

  function disco(x, y, r) {
    return circ(x, y, r, C.metal, C.metalEsc, 1.2) + circ(x, y, r * 0.55, "#78909c") + circ(x, y, 2.3, C.metalEsc);
  }

  /* ---------- exercícios ---------- */

  const K = (t, p) => ({ t, p });
  const EX = {};

  const SENTADO = { hx: 140, lean: 3, ln: [90, 90, 0], lf: [92, 92, 0], an: [20, 40], af: [20, 40] };
  const cadeiraSentado = () => cadeira(126, 46);

  // --- apertar a bola
  EX.bola = {
    T: 2.2, base: SENTADO,
    keys: [K(0, { an: [14, 82], k: 0 }), K(0.5, { an: [14, 82], k: 1 }), K(1, { an: [14, 82], k: 0 })],
    back: cadeiraSentado,
    front(J, p) {
      const a = rad(J.an.ang);
      return circ(J.an.wr[0] + 6 * Math.sin(a), J.an.wr[1] + 6 * Math.cos(a) - 1, 7.5 - 2.6 * p.k, C.bola, "#b9611a", 1.2) +
        circ(J.an.wr[0] + 2, J.an.wr[1] + 2, 3.6, C.pele);
    },
  };

  // --- levantar garrafas (rosca)
  EX.garrafa = {
    T: 3.2, base: Object.assign({}, SENTADO, { lean: 2 }),
    keys: [
      K(0, { an: [3, 6], af: [3, 6] }),
      K(0.42, { an: [3, 130], af: [3, 130] }),
      K(0.55, { an: [3, 130], af: [3, 130] }),
      K(1, { an: [3, 6], af: [3, 6] }),
    ],
    back: cadeiraSentado,
    front(J) {
      return garrafa(J.an.wr, J.an.ang, 0.62) + circ(J.an.wr[0], J.an.wr[1], 4.3, C.pele);
    },
  };

  // --- esticar o joelho com caneleira
  EX.joelho = {
    T: 3.4, base: SENTADO,
    keys: [
      K(0, { ln: [90, 90, 0] }),
      K(0.4, { ln: [90, 6, -78] }),
      K(0.55, { ln: [90, 6, -78] }),
      K(1, { ln: [90, 90, 0] }),
    ],
    back: cadeiraSentado,
    front(J) {
      const k = J.ln.knee, a = J.ln.ank;
      const cx = k[0] + 0.78 * (a[0] - k[0]), cy = k[1] + 0.78 * (a[1] - k[1]);
      const ang = (Math.atan2(a[1] - k[1], a[0] - k[0]) * 180) / Math.PI;
      return '<g transform="translate(' + f1(cx) + " " + f1(cy) + ") rotate(" + f1(ang) + ')">' +
        rect(-4.5, -7.5, 9, 15, 2.5, C.metal, C.metalEsc) + line(0, -7.5, 0, 7.5, 1.4, C.metalEsc) + "</g>";
    },
  };

  // --- levantar da cadeira com ajuda
  EX.cadeiraAjuda = {
    T: 6.5,
    modes: { ln: "ik", lf: "ik", an: "ik", af: "ik" },
    base: { ln: [162, 0, 0], lf: [155, 0, 0] },
    keys: [
      K(0, { hx: 124, hh: 44, lean: 8, an: [166, 103], af: [166, 103] }),
      K(0.1, { hx: 124, hh: 44, lean: 8, an: [166, 103], af: [166, 103] }),
      K(0.3, { hx: 136, hh: 50, lean: 35, an: [178, 100], af: [178, 100] }),
      K(0.48, { hx: 152, hh: 68, lean: 24, an: [183, 100], af: [183, 100] }),
      K(0.62, { hx: 160, hh: 82, lean: 2, an: [186, 104], af: [186, 104] }),
      K(0.76, { hx: 160, hh: 82, lean: 2, an: [186, 104], af: [186, 104] }),
      K(0.88, { hx: 140, hh: 56, lean: 30, an: [178, 100], af: [178, 100] }),
      K(1, { hx: 124, hh: 44, lean: 8, an: [166, 103], af: [166, 103] }),
    ],
    helper: {
      X: 205,
      modes: { an: "ik", af: "ik" },
      base: { hx: 205, lean: 6, ln: [0, 0, 0], lf: [-4, 4, 0] },
      keys: [
        K(0, { an: [244, 103], af: [244, 103] }),
        K(0.1, { an: [244, 103], af: [244, 103] }),
        K(0.3, { an: [232, 100], af: [232, 100] }),
        K(0.48, { an: [227, 100], af: [227, 100] }),
        K(0.62, { an: [224, 104], af: [224, 104] }),
        K(0.76, { an: [224, 104], af: [224, 104] }),
        K(0.88, { an: [232, 100], af: [232, 100] }),
        K(1, { an: [244, 103], af: [244, 103] }),
      ],
    },
    back: () => cadeira(102, 46),
  };

  // --- levantar da cadeira sem ajuda
  EX.cadeiraSozinho = {
    T: 6,
    modes: { ln: "ik", lf: "ik" },
    base: { ln: [162, 0, 0], lf: [155, 0, 0] },
    keys: [
      K(0, { hx: 124, hh: 44, lean: 8, an: [20, 40], af: [20, 40] }),
      K(0.1, { hx: 124, hh: 44, lean: 8, an: [20, 40], af: [20, 40] }),
      K(0.3, { hx: 136, hh: 50, lean: 35, an: [75, 10], af: [75, 10] }),
      K(0.48, { hx: 152, hh: 68, lean: 24, an: [70, 10], af: [70, 10] }),
      K(0.62, { hx: 160, hh: 82, lean: 2, an: [32, 18], af: [32, 18] }),
      K(0.76, { hx: 160, hh: 82, lean: 2, an: [32, 18], af: [32, 18] }),
      K(0.88, { hx: 140, hh: 56, lean: 30, an: [70, 10], af: [70, 10] }),
      K(1, { hx: 124, hh: 44, lean: 8, an: [20, 40], af: [20, 40] }),
    ],
    back: () => cadeira(102, 46, { bracos: true }),
  };

  // --- agachar como se fosse sentar (de frente para a mesa)
  EX.sentarImaginario = {
    T: 4,
    modes: { ln: "ik", lf: "ik", an: "ik", af: "ik" },
    base: { ln: [152, 0, 0], lf: [146, 0, 0], an: [178, 92], af: [178, 92] },
    keys: [
      K(0, { hx: 148, hh: 82, lean: 4 }),
      K(0.45, { hx: 118, hh: 45, lean: 40 }),
      K(0.58, { hx: 118, hh: 45, lean: 40 }),
      K(1, { hx: 148, hh: 82, lean: 4 }),
    ],
    back: () => cadeira(92, 46) + mesa(172, 252, 88),
  };

  // --- alongar os braços atrás, com a cadeira
  EX.alongBracosCadeira = {
    T: 6,
    modes: { an: "ik", af: "ik" },
    base: { hx: 150, ln: [90, 90, 0], lf: [92, 92, 0], lean: 0 },
    keys: [
      K(0, { an: [153, 50], af: [153, 50], lean: 0 }),
      K(0.22, { an: [121, 72], af: [121, 72], lean: 0 }),
      K(0.5, { an: [121, 72], af: [121, 72], lean: 20 }),
      K(0.75, { an: [121, 72], af: [121, 72], lean: 20 }),
      K(0.9, { an: [121, 72], af: [121, 72], lean: 0 }),
      K(1, { an: [153, 50], af: [153, 50], lean: 0 }),
    ],
    back: () => cadeira(115, 62),
  };

  // --- torcer a toalha
  EX.toalha = {
    T: 2.4,
    modes: { an: "ik", af: "ik" },
    base: Object.assign({}, SENTADO, { an: [170, 80], af: [170, 80] }),
    keys: [K(0, { k: -1 }), K(0.5, { k: 1 }), K(1, { k: -1 })],
    back: cadeiraSentado,
    front(J, p) {
      const x = J.an.wr[0] + 7, y = J.an.wr[1] - 1;
      const g = 'transform="translate(' + f1(x) + " " + f1(y) + ')"';
      const a = p.k * 80;
      return (
        "<g " + g + ">" +
        circ(0, 0, 9, C.toalha, C.toalhaEsc, 1.4) +
        '<path d="M0 0 m0 -6 a6 6 0 1 1 -6 6" fill="none" stroke="' + C.toalhaEsc + '" stroke-width="1.6" transform="rotate(' + f1(a) + ')"/>' +
        '<path d="M-14 -12 a15 15 0 0 1 20 -4" fill="none" stroke="' + C.metalEsc + '" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M6 -16 l2 4 l-5 0 z" fill="' + C.metalEsc + '" transform="rotate(' + f1(-a * 0.2) + ' 6 -16)"/>' +
        "</g>" +
        circ(J.an.wr[0] + 2, J.an.wr[1] + 2, 3.6, C.pele)
      );
    },
  };

  // --- alongar as pernas (sentado)
  EX.alongPernas = {
    T: 6,
    modes: { ln: "ik", an: "ik", af: "ik" },
    base: { hx: 130, hh: 44, ln: [196, 0, -35], lf: [92, 92, 0], an: [164, 54], af: [164, 54] },
    keys: [
      K(0, { lean: 4 }),
      K(0.3, { lean: 4 }),
      K(0.55, { lean: 34 }),
      K(0.78, { lean: 34 }),
      K(1, { lean: 4 }),
    ],
    back: () => cadeira(116, 46),
  };

  /* --- caminhadas ---------------------------------------------------- */

  const defPhi = (p) => {
    if (p < 0.6) { const q = p / 0.6; return -10 + 35 * q * q; }
    return 25 - 35 * ((p - 0.6) / 0.4);
  };

  function walkDef(o) {
    const S = o.S, lift = o.lift, st = 0.6, cyc = o.cycles || 1, A = S / st;
    const am = o.armMode || "fk";
    const def = { T: o.T, modes: { ln: "ik", lf: "ik", an: am, af: am }, poster: o.poster == null ? 0.12 : o.poster };
    def.proc = (s) => {
      const u = (s * cyc) % 1;
      const lg = (p) => {
        p = ((p % 1) + 1) % 1;
        if (p < st) return { x: S / 2 - S * (p / st), l: 0, p };
        const q = (p - st) / (1 - st);
        return { x: -S / 2 + S * q, l: lift * Math.sin(Math.PI * q), p };
      };
      const n = lg(u), f = lg(u + 0.5);
      const phN = o.phi ? o.phi(s, n.p) : defPhi(n.p);
      const phF = o.phi ? o.phi(s, f.p) : defPhi(f.p);
      const hh = (o.hh ? o.hh(s) : 80.6) + 1.1 * Math.cos(4 * Math.PI * (u - 0.3));
      let an, af;
      if (o.arms) {
        const r = o.arms(u, n.p);
        an = r.an; af = r.af;
      } else {
        const sw = o.sw == null ? 22 : o.sw;
        const a = -sw * Math.cos(2 * Math.PI * n.p);
        an = [a, 22 + 10 * (a / sw)];
        af = [-a, 22 - 10 * (a / sw)];
      }
      return {
        hx: CX, hh, lean: o.lean == null ? 5 : o.lean, head: 0,
        ln: [CX + n.x, n.l, phN], lf: [CX + f.x, f.l, phF], an, af, u, k: s,
      };
    };
    def.back = (J, p, s) => {
      const sc = s * cyc * A;
      return chao(sc, A / 2) + (o.back ? o.back(J, p, s, sc, A) : "");
    };
    if (o.front) def.front = o.front;
    def.A = A;
    def.cyc = cyc;
    return def;
  }

  EX.caminhar = walkDef({ S: 32, lift: 9, T: 1.7, lean: 5, sw: 22 });

  // com apoio (corrimão), devagar — passaporte A
  EX.caminharA = walkDef({
    S: 16, lift: 5, T: 3.6, lean: 9, armMode: "ik",
    arms: () => ({ an: [CX + 27, 88], af: [CX + 24, 87] }),
    back: () => line(CX + 6, G - 88, 228, G - 88, 4, C.madeiraEsc) + line(224, G - 88, 224, G, 4, C.madeiraEsc),
  });

  // ritmo forte — E-fit (caminhar ou trotar)
  EX.caminharE = walkDef({ S: 42, lift: 14, T: 1.1, lean: 10, sw: 34 });

  // pés em linha, calcanhar com ponta
  EX.linha = walkDef({
    S: 20, lift: 6, T: 2.2, lean: 3, armMode: "fk",
    arms: (u, p) => ({ an: [38, 38], af: [32, 40] }),
    back: () => rect(0, G - 0.5, W, 3, 1, C.fita),
  });

  // andar nas pontas e nos calcanhares
  EX.pontasCalcanhares = walkDef({
    S: 22, lift: 8, T: 7, cycles: 4, lean: 3, sw: 14,
    phi: (s) => {
      const q = s < 0.5 ? s * 2 : (s - 0.5) * 2; // 0..1 em cada metade
      const emPontas = s < 0.5;
      const t = q < 0.06 ? q / 0.06 : q > 0.94 ? (1 - q) / 0.06 : 1;
      const a = emPontas ? 42 : -36;
      return a * (t < 1 ? t * 0.4 + 0.6 : 1);
    },
    hh: (s) => (s < 0.5 ? 86.3 : 82.4),
    back: (J, p, s) => {
      const t = s < 0.5 ? "NA PONTA DOS PÉS" : "NOS CALCANHARES";
      return '<text x="160" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="' + C.camisa + '" font-family="system-ui,sans-serif">' + t + "</text>";
    },
  });

  // passar por cima de obstáculos (mão no corrimão)
  EX.obstaculos = walkDef({
    S: 30, lift: 21, T: 2.2, lean: 4, armMode: "ik",
    arms: () => ({ an: [CX + 26, 90], af: [CX + 23, 89] }),
    back: (J, p, s, sc, A) => {
      let o = line(CX + 6, G - 90, 228, G - 90, 4, C.madeiraEsc) + line(224, G - 90, 224, G, 4, C.madeiraEsc);
      for (let k = -4; k <= 8; k++) {
        const x = CX + 0.8 * A - sc + (k * A) / 2;
        if (x < -20 || x > W + 20) continue;
        o += rect(x - 3, G - 1.5, 6, 3.5, 1, C.fita);
        o += '<rect x="' + f1(x - 4) + '" y="' + f1(G - 14) + '" width="8" height="13" rx="1.5" fill="none" stroke="' + C.fita + '" stroke-width="1.2" stroke-dasharray="2.5 2.5"/>';
      }
      return o;
    },
  });

  // caminhar tocando um balão
  EX.balao = walkDef({
    S: 28, lift: 8, T: 1.8, lean: 3, armMode: "ik",
    arms: (u) => ({ an: [CX + 22, 104 + 5 * Math.sin(4 * Math.PI * u + 3)], af: [CX + 22, 103 + 5 * Math.sin(4 * Math.PI * u + 3)] }),
    front: (J, p) => {
      const t = Math.abs(Math.sin(2 * Math.PI * p.u));
      const by = G - (124 + 26 * t), bx = CX + 25 + 8 * Math.sin(2 * Math.PI * p.u);
      return line(bx, by + 17, J.an.wr[0] + 2, J.an.wr[1] - 3, 0.9, "#999") +
        '<ellipse cx="' + f1(bx) + '" cy="' + f1(by) + '" rx="12" ry="15" fill="' + C.balao + '"/>' +
        '<ellipse cx="' + f1(bx - 4) + '" cy="' + f1(by - 5) + '" rx="3" ry="5" fill="#fff" opacity=".35"/>' +
        circ(J.an.wr[0], J.an.wr[1], 4.3, C.pele);
    },
  });

  // subir e descer escadas (esteira de degraus)
  (function () {
    const R = 25, Hs = 15, dx0 = 12.5, d0 = 64, hh = 80, lift = 24;
    const def = {
      T: 3.6, poster: 0.1,
      modes: { ln: "ik", lf: "ik", an: "ik", af: "ik" },
    };
    def.proc = (s) => {
      const lg = (p) => {
        p = ((p % 1) + 1) % 1;
        let x, dy, ph;
        if (p < 0.5) { const q = p / 0.5; x = dx0 - 25 * q; dy = d0 + 15 * q; ph = 22 * Math.max(0, q - 0.75) / 0.25; }
        else { const q = (p - 0.5) / 0.5; x = -dx0 + 25 * q; dy = d0 + 15 - 15 * q - lift * Math.sin(Math.PI * q); ph = 20 * (1 - q); }
        return [CX + x, hh - dy, ph];
      };
      return {
        hx: CX, hh, lean: 12, head: 0,
        ln: lg(s), lf: lg(s + 0.5),
        an: [CX + 26, hh + 14], af: [CX + 23, hh + 13], u: s,
      };
    };
    def.back = (J, p, s) => {
      const hipY = J.hip[1];
      const shx = -50 * s, shy = 30 * s;
      let d = "";
      const pts = [];
      for (let k = -8; k <= 8; k++) {
        const cx = CX + dx0 + R * k + shx, y = hipY + d0 - Hs * k + shy;
        pts.push([cx - 12.5, y], [cx + 12.5, y]);
      }
      d = "M" + f1(pts[0][0]) + "," + f1(H + 80);
      pts.forEach((q) => { d += " L" + f1(q[0]) + "," + f1(q[1]); });
      d += " L" + f1(pts[pts.length - 1][0]) + "," + f1(H + 80) + " Z";
      // corrimão (paralelo aos degraus, fixo em relação ao corpo)
      const hx0 = CX + 26, hy0 = G - (hh + 14);
      const rail = line(hx0 - 80, hy0 + 48, hx0 + 120, hy0 - 72, 4, C.madeiraEsc);
      return '<path d="' + d + '" fill="' + C.chao + '" stroke="' + C.linha + '" stroke-width="1.5" stroke-linejoin="round"/>' + rail;
    };
    def.floor = false;
    EX.escadas = def;
  })();

  // equilíbrio em uma perna
  EX.umaPerna = {
    T: 5, base: { an: [34, 6], af: [34, 6], lf: [0, 0, 0] },
    keys: [
      K(0, { ln: [-2, 3, 0] }),
      K(0.22, { ln: [52, 88, 25] }),
      K(0.75, { ln: [52, 88, 25] }),
      K(1, { ln: [-2, 3, 0] }),
    ],
  };

  // alongar os braços para o alto
  EX.alongBracos = {
    T: 4,
    keys: [
      K(0, { an: [4, 8], af: [4, 8], lean: 0, head: 0 }),
      K(0.35, { an: [172, 0], af: [172, 0], lean: -3, head: -6 }),
      K(0.7, { an: [172, 0], af: [172, 0], lean: -3, head: -6 }),
      K(1, { an: [4, 8], af: [4, 8], lean: 0, head: 0 }),
    ],
  };

  /* --- exercícios com barra (E-fit) ----------------------------------- */

  const JOELHOS = { ln: [4, 8, 0], lf: [2, 10, 0] };

  EX.biceps = {
    T: 3.4, base: JOELHOS,
    keys: [
      K(0, { an: [3, 6], af: [3, 6] }),
      K(0.45, { an: [3, 132], af: [3, 132] }),
      K(0.55, { an: [3, 132], af: [3, 132] }),
      K(1, { an: [3, 6], af: [3, 6] }),
    ],
    front: (J) => disco(J.an.wr[0] + 1, J.an.wr[1] + 1, 9) + circ(J.an.wr[0] - 3, J.an.wr[1] + 1, 3.6, C.pele),
  };

  (function () {
    const ank = [150, 0, 0];
    const base = { ln: ank, lf: [144, 0, 0], hx: 138, hh: 70, lean: 58, head: -20 };
    const sh = (lean, hx, hh) => [hx + D.torso * Math.sin(rad(lean)), hh + D.torso * Math.cos(rad(lean))];
    // posição do alvo em coordenadas (x, altura)
    const alvo = (lean, hx, hh, sobe) => {
      const s = sh(lean, hx, hh);
      if (!sobe) return [s[0] + 3, s[1] - 44];
      const u = [Math.sin(rad(lean)), Math.cos(rad(lean))];
      const n = [Math.cos(rad(lean)), -Math.sin(rad(lean))];
      return [s[0] - 12 * u[0] + 11 * n[0], s[1] - 12 * u[1] + 11 * n[1]];
    };
    const emBaixo = alvo(58, 138, 70, false), emCima = alvo(58, 138, 70, true);
    EX.remada = {
      T: 3.4,
      modes: { ln: "ik", lf: "ik", an: "ik", af: "ik" },
      base,
      keys: [
        K(0, { an: emBaixo, af: emBaixo }),
        K(0.42, { an: emCima, af: emCima }),
        K(0.55, { an: emCima, af: emCima }),
        K(1, { an: emBaixo, af: emBaixo }),
      ],
      front: (J) => disco(J.an.wr[0] + 1, J.an.wr[1], 9) + circ(J.an.wr[0] - 3, J.an.wr[1], 3.4, C.pele),
    };
  })();

  (function () {
    // barra apoiada nos ombros; alvo das mãos fica junto da barra
    const barra = (lean, hx, hh) => {
      const s = [hx + D.torso * Math.sin(rad(lean)), hh + D.torso * Math.cos(rad(lean))];
      const n = [Math.cos(rad(lean)), -Math.sin(rad(lean))]; // para a frente, em (x, altura)
      const u = [Math.sin(rad(lean)), Math.cos(rad(lean))];
      return [s[0] - 6 * n[0] + 2 * u[0], s[1] - 6 * n[1] + 2 * u[1]];
    };
    const mk = (lean, hx, hh) => { const b = barra(lean, hx, hh); return [b[0] + 1, b[1] - 3]; };
    const frontBarra = (J, leanDeg) => {
      const l = rad(leanDeg);
      const s = J.sh, n = [Math.cos(l), Math.sin(l)], u = [Math.sin(l), -Math.cos(l)];
      const bx = s[0] - 6 * n[0] + 2 * u[0], by = s[1] - 6 * n[1] + 2 * u[1];
      return disco(bx, by, 9);
    };

    // agachamento
    const A0 = mk(4, 148, 82), A1 = mk(40, 118, 44);
    EX.agachamento = {
      T: 4,
      modes: { ln: "ik", lf: "ik", an: "ikr", af: "ikr" },
      base: { ln: [152, 0, 0], lf: [146, 0, 0] },
      keys: [
        K(0, { hx: 148, hh: 82, lean: 4, an: A0, af: A0 }),
        K(0.45, { hx: 118, hh: 44, lean: 40, an: A1, af: A1 }),
        K(0.58, { hx: 118, hh: 44, lean: 40, an: A1, af: A1 }),
        K(1, { hx: 148, hh: 82, lean: 4, an: A0, af: A0 }),
      ],
      front: (J, p) => frontBarra(J, p.lean),
    };

    // passadas
    const L = (x, hh, lean) => ({ hx: x, hh, lean });
    const bx = (lean, hx, hh) => { const b = mk(lean, hx, hh); return { an: b, af: b }; };
    const P0 = Object.assign(L(148, 82, 3), bx(3, 148, 82), { ln: [152, 0, 0], lf: [144, 0, 0] });
    const P1 = Object.assign(L(150, 82, 3), bx(3, 150, 82), { ln: [176, 20, 0], lf: [144, 0, 0] });
    const P2 = Object.assign(L(160, 72, 3), bx(3, 160, 72), { ln: [196, 0, 0], lf: [124, 0, 55] });
    const P3 = Object.assign(L(158, 46, 4), bx(4, 158, 46), { ln: [196, 0, 0], lf: [124, 0, 55] });
    EX.passadas = {
      T: 7.5,
      modes: { ln: "ik", lf: "ik", an: "ikr", af: "ikr" },
      keys: [
        K(0, P0), K(0.1, P0), K(0.22, P1), K(0.32, P2), K(0.5, P3), K(0.6, P3),
        K(0.72, P2), K(0.82, P1), K(0.92, P0), K(1, P0),
      ],
      front: (J, p) => frontBarra(J, p.lean),
    };
  })();

  /* --- vista de cima: caminhar em oito -------------------------------- */

  EX.oitos = {
    T: 7,
    custom(s) {
      const cx = 160, cy = 112, A = 104, B = 96;
      const t = s * 2 * Math.PI;
      const pos = (tt) => [cx + A * Math.cos(tt), cy + (B * Math.sin(2 * tt)) / 2];
      let trilha = "";
      for (let i = 0; i <= 90; i++) trilha += (i ? "L" : "M") + pt(pos((i / 90) * 2 * Math.PI)) + " ";
      const p = pos(t);
      const dx = -A * Math.sin(t), dy = B * Math.cos(2 * t);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      const g1 = [cx - A / 2, cy], g2 = [cx + A / 2, cy];
      const gar = (q) => circ(q[0], q[1], 10, "#dcecf7", "#7fb3d6", 1.8) + circ(q[0], q[1], 6, C.agua);
      return (
        rect(14, 18, W - 28, H - 36, 14, "#f6faf9", C.linha) +
        '<path d="' + trilha + '" fill="none" stroke="' + C.linha + '" stroke-width="2" stroke-dasharray="5 5"/>' +
        gar(g1) + gar(g2) +
        '<g transform="translate(' + f1(p[0]) + " " + f1(p[1]) + ") rotate(" + f1(ang) + ')">' +
        rect(-6.5, -16, 13, 32, 6.5, C.camisa) +
        circ(-1.5, 0, 9.4, C.cabelo) + circ(0.8, 0, 8.6, C.pele) + '<path d="M8 -3 L14 0 L8 3 Z" fill="' + C.pele + '"/>' +
        "</g>" +
        '<text x="160" y="36" text-anchor="middle" font-size="10" fill="' + C.metal + '" font-family="system-ui,sans-serif">vista de cima</text>'
      );
    },
  };

  /* ---------- motor ---------- */

  // enquadramento de cada exercício: [x, y, largura, altura]
  const VB = {
    bola: [80, 80, 160, 130], garrafa: [80, 80, 160, 130], joelho: [80, 80, 160, 130],
    toalha: [80, 80, 160, 130], alongPernas: [80, 80, 160, 130], alongBracosCadeira: [85, 80, 160, 130],
    cadeiraAjuda: [85, 36, 160, 174], cadeiraSozinho: [85, 36, 160, 174],
    sentarImaginario: [80, 34, 180, 176],
    caminhar: [75, 40, 150, 168], caminharA: [75, 40, 160, 168], caminharE: [70, 40, 160, 168],
    linha: [75, 40, 150, 168], pontasCalcanhares: [70, 8, 160, 200], obstaculos: [72, 40, 170, 168],
    balao: [75, 24, 150, 184], escadas: [55, 36, 210, 172],
    umaPerna: [85, 40, 130, 168], alongBracos: [85, 16, 130, 194],
    biceps: [90, 40, 120, 168], remada: [75, 60, 160, 150],
    agachamento: [80, 42, 140, 168], passadas: [78, 42, 150, 168],
    oitos: [0, 0, W, H],
  };
  const vbDe = (id) => (VB[id] || [0, 0, W, H]).join(" ");

  function normaliza(def) {
    if (def._ok) return def;
    def._ok = true;
    const merge = (b, p) => Object.assign({}, BASE, def.base || {}, b || {}, p || {});
    if (def.keys) def.ks = def.keys.map((k) => ({ t: k.t, p: merge(null, k.p) }));
    if (def.helper) {
      const h = def.helper;
      h.ks = h.keys.map((k) => ({ t: k.t, p: Object.assign({}, BASE, h.base || {}, k.p) }));
    }
    return def;
  }

  function mix(a, b, t) {
    if (typeof a === "number") return a + (b - a) * t;
    if (Array.isArray(a)) return a.map((v, i) => mix(v, b[i], t));
    return a;
  }
  function mixPose(a, b, t) {
    const o = {};
    for (const k in a) o[k] = a[k] == null ? b[k] : b[k] == null ? a[k] : mix(a[k], b[k], t);
    return o;
  }
  function poseAt(ks, s) {
    for (let i = 0; i < ks.length - 1; i++) {
      if (s >= ks[i].t && s <= ks[i + 1].t) {
        const span = ks[i + 1].t - ks[i].t;
        const u = span > 0 ? (s - ks[i].t) / span : 0;
        return mixPose(ks[i].p, ks[i + 1].p, ease(u));
      }
    }
    return ks[ks.length - 1].p;
  }

  let UID = 0;

  function ambiente(uid) {
    const p = "pf" + uid;
    return (
      "<defs>" +
      '<linearGradient id="' + p + 'p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f2ea"/><stop offset="1" stop-color="#e6dfd2"/></linearGradient>' +
      '<linearGradient id="' + p + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdbda3"/><stop offset="1" stop-color="#b9a688"/></linearGradient>' +
      '<radialGradient id="' + p + 's"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + p + 'l" cx=".72" cy=".25" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      "</defs>"
    );
  }

  function cena(id, s, uid) {
    const def = normaliza(EX[id]);
    const p = "pf" + uid;
    let o = "";
    if (def.custom) return def.custom(s);
    o += ambiente(uid);
    // parede com luz suave
    o += '<rect x="-40" width="' + (W + 80) + '" height="' + H + '" fill="url(#' + p + 'p)"/>';
    o += '<rect x="-40" width="' + (W + 80) + '" height="' + H + '" fill="url(#' + p + 'l)"/>';
    if (def.floor !== false) {
      // rodapé e piso de madeira clara
      o += rect(-40, G - 8, W + 80, 8, 0, "#fbf9f4") + line(-40, G - 8, W + 40, G - 8, 0.8, "#d8d0c0");
      o += '<rect x="-40" y="' + G + '" width="' + (W + 80) + '" height="' + (H - G + 20) + '" fill="url(#' + p + 'c)"/>';
      o += line(-40, G, W + 40, G, 1.2, "#a8946f");
      for (let k = 1; k < 4; k++) o += line(-40, G + k * 6.5, W + 40, G + k * 6.5, 0.6, "#a8946f").replace("/>", ' stroke-opacity=".45"/>');
    }
    let pose;
    if (def.proc) {
      pose = Object.assign({}, BASE, def.base || {}, def.proc(s));
    } else pose = poseAt(def.ks, s);
    const J = solve(pose, def.modes);
    if (def.back) o += def.back(J, pose, s);
    if (def.helper) {
      const h = def.helper, hp = poseAt(h.ks, s), hJ = solve(hp, h.modes);
      o += '<g transform="translate(' + 2 * h.X + ' 0) scale(-1 1)">' + figura(hJ, { camisa: C.ajuda, camisaF: C.ajudaF }) + "</g>";
    }
    if (def.floor !== false) o += '<ellipse cx="' + f1(J.hip[0] + 4) + '" cy="' + (G + 3) + '" rx="34" ry="4.6" fill="url(#' + p + 's)"/>';
    o += figura(J);
    if (def.front) o += def.front(J, pose, s);
    return o;
  }

  const SVGNS = "http://www.w3.org/2000/svg";

  function svgFechado(id, s, titulo) {
    return '<svg xmlns="' + SVGNS + '" viewBox="' + vbDe(id) + '" role="img" aria-label="' + (titulo || id) + '">' + cena(id, s, ++UID) + "</svg>";
  }

  const ativos = [];
  let raf = null;

  function laco(ts) {
    raf = null;
    for (let i = ativos.length - 1; i >= 0; i--) if (!ativos[i].svg.isConnected) ativos.splice(i, 1);
    let alguem = false;
    ativos.forEach((a) => {
      if (!a.rodando) return;
      alguem = true;
      if (a.ult == null) a.ult = ts;
      const dt = ts - a.ult;
      if (dt < 30) return;
      a.ult = ts;
      a.t += (dt / 1000) * a.vel;
      a.pinta();
    });
    if (alguem) raf = requestAnimationFrame(laco);
  }

  function montar(id, titulo) {
    if (!EX[id]) return null;
    const def = normaliza(EX[id]);
    const wrap = document.createElement("div");
    wrap.className = "fig";
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", vbDe(id));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Animação do exercício: " + (titulo || id));
    wrap.append(svg);

    const reduz = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const uid = ++UID;
    const a = { svg, t: 0, vel: 1, rodando: false, ult: null };
    const pos = () => ((a.t / def.T) % 1 + 1) % 1;
    a.pinta = () => { svg.innerHTML = cena(id, pos(), uid); };
    a.pinta();
    a.t = (def.poster == null ? 0.3 : def.poster) * def.T;
    a.pinta();

    const barra = document.createElement("div");
    barra.className = "fig-ctl";
    const bPlay = document.createElement("button");
    bPlay.type = "button";
    const bVel = document.createElement("button");
    bVel.type = "button";
    const rot = () => {
      bPlay.textContent = a.rodando ? "Pausar" : "Animar";
      bVel.textContent = a.vel < 1 ? "Velocidade normal" : "Mais devagar";
    };
    const liga = () => {
      a.rodando = true; a.ult = null; rot();
      if (ativos.indexOf(a) < 0) ativos.push(a);
      if (!raf) raf = requestAnimationFrame(laco);
    };
    const desliga = () => { a.rodando = false; rot(); };
    bPlay.addEventListener("click", () => (a.rodando ? desliga() : liga()));
    bVel.addEventListener("click", () => { a.vel = a.vel < 1 ? 1 : 0.5; rot(); });
    rot();
    barra.append(bPlay, bVel);
    wrap.append(barra);

    wrap.fig = {
      start() { if (!reduz) liga(); },
      stop() { desliga(); },
    };
    return wrap;
  }

  // dados da pose para o motor 3D (juntas em 2D, vista lateral)
  function dados(id, s) {
    const def = normaliza(EX[id]);
    const pose = def.proc ? Object.assign({}, BASE, def.base || {}, def.proc(s)) : poseAt(def.ks, s);
    const J = solve(pose, def.modes);
    let H = null;
    if (def.helper) H = solve(poseAt(def.helper.ks, s), def.helper.modes);
    return {
      J, H, pose, helperX: def.helper ? def.helper.X : null,
      scroll: def.A ? s * (def.cyc || 1) * def.A : 0, A: def.A || 0,
      floor: def.floor !== false, T: def.T, G, CX, VB: VB[id] || [0, 0, W, H],
    };
  }

  root.Figuras = {
    dados,
    tem: (id) => !!EX[id],
    montar,
    quadro: svgFechado,
    ids: () => Object.keys(EX),
    duracao: (id) => EX[id].T,
  };
})(typeof window !== "undefined" ? window : globalThis);
