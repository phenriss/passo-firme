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
    return { heel, toe, d: Math.max(heel[1], toe[1]) };
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
      hip: [hx, hy], sh, hc, lean: p.lean,
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

  // segmento "carnudo": largura diminui de r1 (em a) para r2 (em b), pontas arredondadas
  function seg(a, b, r1, r2, fill, brilho) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len;
    let o = '<path d="M' + pt([a[0] + nx * r1, a[1] + ny * r1]) + "L" + pt([b[0] + nx * r2, b[1] + ny * r2]) +
      "L" + pt([b[0] - nx * r2, b[1] - ny * r2]) + "L" + pt([a[0] - nx * r1, a[1] - ny * r1]) + 'Z" fill="' + fill + '"/>' +
      circ(a[0], a[1], r1, fill) + circ(b[0], b[1], r2, fill);
    if (brilho) {
      const k = 0.38;
      o += '<line x1="' + f1(a[0] - nx * r1 * k) + '" y1="' + f1(a[1] - ny * r1 * k) + '" x2="' + f1(b[0] - nx * r2 * k) +
        '" y2="' + f1(b[1] - ny * r2 * k) + '" stroke="#fff" stroke-opacity=".16" stroke-width="' + f1((r1 + r2) * 0.42) +
        '" stroke-linecap="round"/>';
    }
    return o;
  }

  // tronco com costas, barriga e peito (vista lateral)
  function tronco(J, fill) {
    const u = [J.sh[0] - J.hip[0], J.sh[1] - J.hip[1]];
    const len = Math.sqrt(u[0] * u[0] + u[1] * u[1]) || 1;
    const ux = u[0] / len, uy = u[1] / len, fx = -uy, fy = ux; // fx,fy aponta para a frente
    const at = (t, back, front) => [
      [J.hip[0] + u[0] * t - fx * back, J.hip[1] + u[1] * t - fy * back],
      [J.hip[0] + u[0] * t + fx * front, J.hip[1] + u[1] * t + fy * front],
    ];
    const P = [at(0, 9.5, 9), at(0.35, 8.2, 10.2), at(0.72, 9.4, 10.4), at(1, 6.2, 6.2)];
    let d = "M" + pt(P[0][0]);
    for (let i = 1; i < P.length; i++) d += "L" + pt(P[i][0]);
    for (let i = P.length - 1; i >= 0; i--) d += "L" + pt(P[i][1]);
    return '<path d="' + d + 'Z" fill="' + fill + '" stroke="' + fill + '" stroke-width="4" stroke-linejoin="round"/>';
  }

  function mao(wr, ang, cor) {
    const a = rad(ang);
    return circ(wr[0] + 1.8 * Math.sin(a), wr[1] + 1.8 * Math.cos(a), 3.7, cor);
  }

  function tenis(L, frente) {
    const dx = L.toe[0] - L.heel[0], dy = L.toe[1] - L.heel[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len; // normal (para baixo no pé plano)
    const topo = frente ? "#f4f7f6" : "#cdd6d3";
    const sola = frente ? "#2a3a36" : "#55635e";
    return (
      line(L.heel[0], L.heel[1] - 0.5, L.toe[0], L.toe[1] - 0.5, 7.2, topo) +
      line(L.heel[0] + nx * 2.7, L.heel[1] + ny * 2.7 - 0.5, L.toe[0] + nx * 2.7, L.toe[1] + ny * 2.7 - 0.5, 2.2, sola) +
      line(L.ank[0], L.ank[1] - 0.5, L.ank[0] + 1.5, L.ank[1] + 3, 6.6, topo)
    );
  }

  function figura(J, pal) {
    pal = pal || { camisa: C.camisa, camisaF: C.camisaF };
    let s = "";
    // lado de trás (mais escuro/claro para dar profundidade)
    s += seg(J.hip, J.lf.knee, 7.4, 5.8, C.calcaF) + seg(J.lf.knee, J.lf.ank, 5.8, 4.1, C.calcaF);
    s += tenis(J.lf, false);
    s += seg(J.sh, J.af.el, 4.8, 3.9, pal.camisaF) + seg(J.af.el, J.af.wr, 3.5, 2.8, C.peleEsc);
    s += mao(J.af.wr, J.af.ang, C.peleEsc);
    // quadril e tronco
    s += circ(J.hip[0], J.hip[1], 9.2, C.calca);
    s += tronco(J, pal.camisa);
    // colarinho, pescoço e cabeça
    const nk = [(J.sh[0] * 0.35 + J.hc[0] * 0.65), (J.sh[1] * 0.35 + J.hc[1] * 0.65)];
    s += seg(J.sh, nk, 3.9, 3.2, C.pele);
    s += circ(J.sh[0] + 0.6, J.sh[1] + 0.6, 4.4, pal.camisa);
    const hx = J.hc[0], hy = J.hc[1];
    s += circ(hx - 2.6, hy - 1.3, 9.9, C.cabelo);                 // cabelo (atrás)
    s += circ(hx - 7.4, hy + 1.2, 4.4, C.cabelo);                 // coque baixo
    s += '<ellipse cx="' + f1(hx + 1) + '" cy="' + f1(hy + 1) + '" rx="8.1" ry="9" fill="' + C.pele + '"/>';
    s += '<path d="M' + pt([hx - 7.6, hy - 1.5]) + "Q" + pt([hx - 1, hy - 11.4]) + " " + pt([hx + 7.4, hy - 4.2]) +
      "Q" + pt([hx + 1, hy - 5.4]) + " " + pt([hx - 7.6, hy + 1.5]) + 'Z" fill="' + C.cabelo + '"/>'; // franja
    s += circ(hx - 1.6, hy + 1.7, 2.3, C.peleEsc);                // orelha
    s += circ(hx + 9, hy + 2.3, 1.7, C.pele);                     // nariz
    s += circ(hx + 4.8, hy - 0.6, 1.05, "#2b2623");               // olho
    s += line(hx + 3.2, hy - 2.6, hx + 6.8, hy - 2.9, 0.9, "#8d99a0"); // sobrancelha
    s += '<circle cx="' + f1(hx + 4.9) + '" cy="' + f1(hy - 0.4) + '" r="3" fill="none" stroke="#3b4a54" stroke-width=".7"/>'; // óculos
    s += line(hx + 4.4, hy + 5.1, hx + 7.4, hy + 5.0, 0.9, "#b0705f"); // boca
    s += circ(hx + 4, hy + 3.1, 1.8, "#f0a28f").replace('fill="', 'fill-opacity=".35" fill="'); // bochecha
    // lado da frente
    s += seg(J.hip, J.ln.knee, 7.6, 6, C.calca, true) + seg(J.ln.knee, J.ln.ank, 6, 4.3, C.calca, true);
    s += tenis(J.ln, true);
    s += seg(J.sh, J.an.el, 5, 4.1, pal.camisa, true) + seg(J.an.el, J.an.wr, 3.7, 3, C.pele);
    s += mao(J.an.wr, J.an.ang, C.pele);
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

  function cena(id, s) {
    const def = normaliza(EX[id]);
    let o = "";
    if (def.custom) return def.custom(s);
    o += '<rect width="' + W + '" height="' + H + '" fill="' + C.fundo + '"/>';
    if (def.floor !== false) {
      o += rect(0, G - 7, W, 7, 0, "#dfeae7") + '<rect y="' + G + '" width="' + W + '" height="' + (H - G) + '" fill="' + C.chao + '"/>' +
        line(0, G, W, G, 1.5, C.linha) + rect(0, G + 1, W, 9, 0, "#dce9e5");
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
    if (def.floor !== false) o += '<ellipse cx="' + f1(J.hip[0] + 4) + '" cy="' + (G + 2) + '" rx="30" ry="3.6" fill="#000" fill-opacity=".10"/>';
    o += figura(J);
    if (def.front) o += def.front(J, pose, s);
    return o;
  }

  const SVGNS = "http://www.w3.org/2000/svg";

  function svgFechado(id, s, titulo) {
    return '<svg xmlns="' + SVGNS + '" viewBox="' + vbDe(id) + '" role="img" aria-label="' + (titulo || id) + '">' + cena(id, s) + "</svg>";
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
    const a = { svg, t: 0, vel: 1, rodando: false, ult: null };
    const pos = () => ((a.t / def.T) % 1 + 1) % 1;
    a.pinta = () => { svg.innerHTML = cena(id, pos()); };
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

  root.Figuras = {
    tem: (id) => !!EX[id],
    montar,
    quadro: svgFechado,
    ids: () => Object.keys(EX),
    duracao: (id) => EX[id].T,
  };
})(typeof window !== "undefined" ? window : globalThis);
