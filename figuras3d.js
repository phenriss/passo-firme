/* Passo Firme — bonecos 3D (WebGL puro, sem bibliotecas).
 *
 * Reaproveita os movimentos de figuras.js (esqueleto em 2D, vista lateral) e os leva
 * para o espaço 3D: cada lado do corpo ganha uma profundidade (z), e o corpo é montado
 * com formas volumétricas (membros afilados, tronco, cabeça com rosto, mãos, tênis).
 * A câmera orbita: dá para girar com o dedo ou trocar o ângulo pelos botões.
 */
(function (root) {
  "use strict";

  const F2 = root.Figuras;
  const G = 200, CX = 150;
  const FOV = 28; // graus, vertical

  /* ------------------------------------------------------------------ */
  /* matemática                                                           */
  /* ------------------------------------------------------------------ */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.sqrt(dot(a, a));
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const rad = (d) => (d * Math.PI) / 180;

  const ID = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const m4 = (x, y, z, t) => [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, t[0], t[1], t[2], 1];
  function mm(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }
  const trM = (p) => m4([1, 0, 0], [0, 1, 0], [0, 0, 1], p);
  const scM = (s) => m4([s[0], 0, 0], [0, s[1], 0], [0, 0, s[2]], [0, 0, 0]);
  const rzM = (deg) => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return m4([c, s, 0], [-s, c, 0], [0, 0, 1], [0, 0, 0]); };
  const ryM = (th) => { const c = Math.cos(th), s = Math.sin(th); return m4([c, 0, -s], [0, 1, 0], [s, 0, c], [0, 0, 0]); };
  const rxM = (deg) => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return m4([1, 0, 0], [0, c, s], [0, -s, c], [0, 0, 0]); };

  function persp(fovDeg, asp, n, f) {
    const t = 1 / Math.tan(rad(fovDeg) / 2);
    return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0];
  }
  function lookAt(e, c, up) {
    const z = norm(sub(e, c)), x = norm(cross(up, z)), y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
  }

  // base com eixo y ao longo de "up" e x o mais próximo possível de "fwd"
  function basis(up, fwd) {
    const y = norm(up);
    let x = sub(fwd, mul(y, dot(fwd, y)));
    if (len(x) < 1e-4) x = sub([0, 0, 1], mul(y, y[2]));
    x = norm(x);
    return { x, y, z: cross(x, y) };
  }

  /* ------------------------------------------------------------------ */
  /* malhas                                                               */
  /* ------------------------------------------------------------------ */
  function loft(secs, nr, esfera) {
    const P = [];
    secs.forEach((s) => {
      const row = [];
      for (let j = 0; j < nr; j++) {
        const th = (j / nr) * Math.PI * 2;
        row.push([(s.cx || 0) + s.rx * Math.cos(th), s.y, (s.cz || 0) + s.rz * Math.sin(th)]);
      }
      P.push(row);
    });
    const ni = secs.length, pos = [], nor = [], idx = [];
    for (let i = 0; i < ni; i++)
      for (let j = 0; j < nr; j++) {
        const p = P[i][j];
        let n;
        if (esfera) n = norm(p);
        else {
          const tt = sub(P[i][(j + 1) % nr], P[i][(j + nr - 1) % nr]);
          const ty = sub(P[Math.min(i + 1, ni - 1)][j], P[Math.max(i - 1, 0)][j]);
          n = cross(ty, tt);
          if (len(n) < 1e-6) n = [0, i === 0 ? -1 : 1, 0];
          n = norm(n);
          const c = [secs[i].cx || 0, secs[i].y, secs[i].cz || 0];
          const rv = sub(p, c);
          if (dot(n, [rv[0], 0, rv[2]]) < 0) n = mul(n, -1);
        }
        pos.push(p[0], p[1], p[2]);
        nor.push(n[0], n[1], n[2]);
      }
    for (let i = 0; i < ni - 1; i++)
      for (let j = 0; j < nr; j++) {
        const a = i * nr + j, b = i * nr + ((j + 1) % nr), c = (i + 1) * nr + j, d = (i + 1) * nr + ((j + 1) % nr);
        idx.push(a, c, b, b, c, d);
      }
    return { pos, nor, idx };
  }

  // tubo ao longo de y de 0 a 1 com perfil de raios [[t, rx, rz?, cx?]]
  const tubo = (perfil, nr) =>
    loft(perfil.map((q) => ({ y: q[0], rx: q[1], rz: q[2] == null ? q[1] : q[2], cx: q[3] || 0 })), nr || 18, false);

  function esfera(nr, ns) {
    const secs = [];
    for (let k = 0; k <= ns; k++) {
      const f = -Math.PI / 2 + (Math.PI * k) / ns;
      secs.push({ y: Math.sin(f), rx: Math.max(Math.cos(f), 1e-4), rz: Math.max(Math.cos(f), 1e-4) });
    }
    return loft(secs, nr, true);
  }

  function caixa() {
    const pos = [], nor = [], idx = [];
    const faces = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
      [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, 1], [-1, 0, 0]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    ];
    faces.forEach((f) => {
      const n = f[0], u = f[1], v = f[2], base = pos.length / 3;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach((q) => {
        const p = add(mul(n, 0.5), add(mul(u, q[0] * 0.5), mul(v, q[1] * 0.5)));
        pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]);
      });
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    return { pos, nor, idx };
  }

  // cilindro de raio 1, y de 0 a 1, com tampas
  function cilindro(nr) {
    const pos = [], nor = [], idx = [];
    for (let j = 0; j < nr; j++) {
      const th = (j / nr) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      pos.push(c, 0, s, c, 1, s); nor.push(c, 0, s, c, 0, s);
    }
    for (let j = 0; j < nr; j++) {
      const a = j * 2, b = a + 1, c = ((j + 1) % nr) * 2, d = c + 1;
      idx.push(a, b, c, c, b, d);
    }
    [0, 1].forEach((y) => {
      const base = pos.length / 3;
      pos.push(0, y, 0); nor.push(0, y ? 1 : -1, 0);
      for (let j = 0; j < nr; j++) {
        const th = (j / nr) * Math.PI * 2;
        pos.push(Math.cos(th), y, Math.sin(th)); nor.push(0, y ? 1 : -1, 0);
      }
      for (let j = 0; j < nr; j++) idx.push(base, base + 1 + j, base + 1 + ((j + 1) % nr));
    });
    return { pos, nor, idx };
  }

  // anel (toro) no plano xz, raio maior 1 e raio do tubo r
  function toro(r, nr, nt) {
    const pos = [], nor = [], idx = [];
    for (let i = 0; i < nr; i++) {
      const a = (i / nr) * Math.PI * 2;
      for (let j = 0; j < nt; j++) {
        const b = (j / nt) * Math.PI * 2;
        const cx = Math.cos(a), cz = Math.sin(a), ct = Math.cos(b), st = Math.sin(b);
        pos.push(cx * (1 + r * ct), r * st, cz * (1 + r * ct));
        nor.push(cx * ct, st, cz * ct);
      }
    }
    for (let i = 0; i < nr; i++)
      for (let j = 0; j < nt; j++) {
        const a = i * nt + j, b = i * nt + ((j + 1) % nt), c = ((i + 1) % nr) * nt + j, d = ((i + 1) % nr) * nt + ((j + 1) % nt);
        idx.push(a, c, b, b, c, d);
      }
    return { pos, nor, idx };
  }

  // perfis (raios absolutos; a posição t é relativa ao comprimento do osso)
  const PERFIL = {
    coxa: tubo([[0, 8.2, 7.8], [0.3, 8.4, 7.9], [0.65, 6.6, 6.4], [1, 5.3, 5.2]]),
    canela: tubo([[0, 5.3, 5.2], [0.25, 5.9, 5.4], [0.65, 4.6, 4.3], [1, 3.4, 3.4]]),
    braco: tubo([[0, 5.2, 4.9], [0.45, 4.7, 4.5], [1, 3.9, 3.8]]),
    antebraco: tubo([[0, 3.8, 3.7], [0.3, 3.9, 3.8], [1, 2.7, 2.8]]),
    tronco: tubo([
      [-0.08, 8.2, 8.5], [0.12, 8.0, 7.9, 0.2], [0.34, 7.8, 7.6, 0.5], [0.55, 9.4, 8.6, 0.9],
      [0.74, 10.0, 9.4, 0.8], [0.9, 8.4, 10.2, 0.2], [1.0, 6.0, 8.6, 0],
    ], 22),
    pescoco: tubo([[0, 4.1], [1, 3.4]], 14),
  };

  const MALHAS = {
    esfera: esfera(18, 12), caixa: caixa(), cil: cilindro(18), toro: toro(0.12, 24, 8),
    coxa: PERFIL.coxa, canela: PERFIL.canela, braco: PERFIL.braco, antebraco: PERFIL.antebraco,
    tronco: PERFIL.tronco, pescoco: PERFIL.pescoco,
  };

  /* ------------------------------------------------------------------ */
  /* cores                                                                */
  /* ------------------------------------------------------------------ */
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255);
  const COR = {
    camisa: hex("#0f6b5c"), calca: hex("#34495e"), pele: hex("#f0c7a0"), peleEsc: hex("#d9a982"),
    cabelo: hex("#b9c1c5"), tenis: hex("#f6f8f7"), sola: hex("#26332f"), detalhe: hex("#0f6b5c"),
    madeira: hex("#c19a6b"), madeiraEsc: hex("#9a7550"), metal: hex("#546e7a"), metalEsc: hex("#263238"),
    agua: hex("#4fa3e0"), vidro: hex("#dcecf7"), tampa: hex("#2c5f8a"), bola: hex("#e8832a"),
    balao: hex("#e5484d"), toalha: hex("#e9a8b8"), toalhaEsc: hex("#c97b92"), fita: hex("#f2b705"),
    ajuda: hex("#c46a1a"), pedra: hex("#cfd6d2"), pedraTopo: hex("#e4e9e6"), preto: hex("#2b2623"),
    boca: hex("#a8584b"), oculos: hex("#3b4a54"), lente: hex("#9fd3e6"),
  };

  /* ------------------------------------------------------------------ */
  /* corpo                                                                */
  /* ------------------------------------------------------------------ */
  // J (2D) -> ponto 3D
  const P3 = (p, z) => [p[0], G - p[1], z];

  // cmds.push({ m: malha, M: matriz local, c: cor, e: brilho })
  function figura3d(cmds, J, o) {
    const pal = o.pal || { camisa: COR.camisa };
    const zl = o.zl == null ? 6.5 : o.zl, zs = 10.4, zh = o.zh == null ? 9.5 : o.zh;
    const R = o.R || ID();
    const FW = [1, 0, 0];
    const out = {};
    const push = (m, M, c, e, ns) => cmds.push({ m, M: mm(R, M), c, e: e || 0, ns: !!ns });

    const eix = (a, b, zz) => [lerp(a[0], b[0], zz), 0, 0]; // (não usado)
    // desenha um osso (tubo) de a até b
    const osso = (m, a, b, c, e, esc) => {
      const d = sub(b, a), bs = basis(d, FW);
      push(m, m4(mul(bs.x, esc || 1), d, mul(bs.z, esc || 1), a), c, e);
    };
    const bola = (c, r, cor, e, sc) => {
      const s = sc || [r, r, r];
      push("esfera", mm(trM(c), scM(s)), cor, e);
    };
    const elip = (base, p, s, cor, e) => push("esfera", mm(base, mm(trM(p), scM(s))), cor, e);

    const lado = (sg) => {
      const L = sg > 0 ? J.ln : J.lf, A = sg > 0 ? J.an : J.af;
      const z = sg * zl, zS = sg * zs, zM = sg * zh;
      const quadril = P3(J.hip, z), joelho = P3(L.knee, z), tornozelo = P3(L.ank, z);
      return { L, A, z, zS, zM, quadril, joelho, tornozelo,
        ombro: P3(J.sh, zS), cotovelo: P3(A.el, (zS + zM) / 2), punho: P3(A.wr, zM) };
    };
    const N = lado(1), Fa = lado(-1);
    out.punhoN = N.punho; out.punhoF = Fa.punho; out.ombroN = N.ombro; out.ombroF = Fa.ombro;

    const perna = (S) => {
      osso("coxa", S.quadril, S.joelho, COR.calca, 0.04);
      bola(S.joelho, 5.3, COR.calca, 0.04);
      osso("canela", S.joelho, S.tornozelo, COR.calca, 0.04);
      // tênis: origem no tornozelo, x para a frente, y para cima, solado a 6 abaixo
      const ph = S.L.phi, c = Math.cos(rad(ph)), s = Math.sin(rad(ph));
      const B = m4([c, -s, 0], [s, c, 0], [0, 0, 1], S.tornozelo);
      elip(B, [3.6, -2.4, 0], [10.6, 4.2, 4.7], COR.tenis, 0.25);   // corpo
      elip(B, [-1.8, 0.4, 0], [4.6, 5.4, 4.5], COR.tenis, 0.2);      // cano
      elip(B, [11.6, -3.2, 0], [4.6, 2.9, 4.1], COR.tenis, 0.28);    // biqueira
      push("caixa", mm(B, mm(trM([4.4, -5.0, 0]), scM([22, 2.4, 9.6]))), COR.sola, 0.1);  // sola
      push("caixa", mm(B, mm(trM([4.4, -1.4, S.z > 0 ? 4.5 : -4.5]), scM([11, 1.3, 0.5]))), COR.detalhe, 0.1); // listra
    };

    const braco = (S, ps) => {
      osso("braco", S.ombro, S.cotovelo, COR.peleEsc === null ? COR.pele : COR.pele, 0.1);
      osso("braco", S.ombro, add(S.ombro, mul(sub(S.cotovelo, S.ombro), 0.62)), pal.camisa, 0.06, 1.13); // manga
      bola(S.cotovelo, 4.1, COR.pele, 0.1);
      osso("antebraco", S.cotovelo, S.punho, COR.pele, 0.12);
      // mão: palma, dedos e polegar na direção do antebraço
      const d = sub(S.punho, S.cotovelo), bs = basis(d, FW), u = norm(d);
      const base = m4(bs.x, bs.y, bs.z, S.punho);
      const sg = S.z > 0 ? 1 : -1;
      elip(base, [0, 3.0, 0], [2.3, 3.6, 3.0], COR.pele, 0.1);
      elip(base, [0.3, 6.6, 0], [1.9, 2.9, 2.7], COR.pele, 0.1);
      elip(base, [1.9, 3.3, -sg * 1.6], [1.1, 2.4, 1.1], COR.pele, 0.1);
      void u;
    };

    // --- lado de trás primeiro (a ordem não importa com z-buffer, mas mantém a leitura) ---
    perna(Fa); braco(Fa);
    perna(N); braco(N);

    // quadril e tronco
    const hip = P3(J.hip, 0), sh = P3(J.sh, 0);
    elip(ID(), hip, [9.2, 8.6, 9.6], COR.calca, 0.05);
    {
      const d = sub(sh, hip), bs = basis(d, FW);
      push("tronco", m4(bs.x, d, bs.z, hip), pal.camisa, 0.07);
      elip(ID(), add(sh, [0.4, -1.2, 0]), [5.4, 3.6, 9.4], pal.camisa, 0.06);  // ombros
      elip(ID(), add(sh, [0.3, 0.4, 0]), [5.1, 2.2, 4.7], pal.camisa, 0.05);    // gola
      push("esfera", mm(R, mm(trM(add(hip, [0, 3.4, 0])), scM([9.6, 3.0, 8.6]))), pal.camisa, 0.05); // bainha
    }
    // pescoço e cabeça
    const hc = P3(J.hc, 0);
    {
      const topo = add(hc, [0, -5, 0]);
      const d = sub(topo, sh), bs = basis(d, FW);
      push("pescoco", m4(bs.x, d, bs.z, sh), COR.pele, 0.1);
      const hd = rad(J.hd);
      const up = [Math.sin(hd), Math.cos(hd), 0], fw = [Math.cos(hd), -Math.sin(hd), 0];
      const bs2 = basis(up, fw);
      const B = m4(bs2.x, bs2.y, bs2.z, hc);
      elip(B, [-1.6, 1.8, 0], [9.2, 9.6, 8.3], COR.cabelo, 0.18);              // cabelo
      elip(B, [-9.6, 0.4, 0], [4.6, 4.6, 4.6], COR.cabelo, 0.18);              // coque
      elip(B, [1.7, -0.8, 0], [7.5, 9.3, 7.1], COR.pele, 0.14);                // rosto
      elip(B, [0.2, 7.2, 0], [8.4, 4.0, 7.6], COR.cabelo, 0.18);               // franja
      elip(B, [9.0, -1.4, 0], [2.0, 2.0, 1.5], COR.pele, 0.14);                // nariz
      elip(B, [6.2, -8.0, 0], [2.7, 2.2, 3.4], COR.pele, 0.12);                // queixo
      [1, -1].forEach((sg) => {
        elip(B, [0, -0.6, sg * 7.0], [1.5, 2.6, 0.9], COR.peleEsc, 0.1);       // orelha
        elip(B, [6.0, 1.8, sg * 3.0], [1.15, 1.1, 0.9], hex("#ffffff"), 0.3);  // olho
        elip(B, [6.9, 1.8, sg * 3.0], [0.6, 0.65, 0.6], COR.preto, 0.4);       // pupila
        push("caixa", mm(B, mm(trM([6.2, 4.2, sg * 3.1]), scM([0.7, 0.55, 2.8]))), hex("#8d99a0"), 0); // sobrancelha
        push("toro", mm(B, mm(trM([6.9, 1.7, sg * 3.2]), mm(rzM(-90), scM([3.1, 3.1, 3.1])))), COR.oculos, 0.3);     // aro
        elip(B, [6.8, 1.7, sg * 3.2], [0.25, 2.9, 2.9], COR.lente, 0.5);                                              // lente (fina)
        push("caixa", mm(B, mm(trM([2.6, 1.9, sg * 7.0]), scM([9.2, 0.45, 0.45]))), COR.oculos, 0.2); // haste
        elip(B, [5.2, -3.2, sg * 3.6], [2.1, 1.5, 1.2], hex("#f2a08e"), 0.05); // bochecha
      });
      push("caixa", mm(B, mm(trM([7.1, 1.9, 0]), scM([0.5, 0.5, 2.2]))), COR.oculos, 0.2);   // ponte
      push("caixa", mm(B, mm(trM([8.0, -4.6, 0]), scM([0.7, 0.55, 3.4]))), COR.boca, 0.2);    // boca
    }
    out.J = J;
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* objetos                                                              */
  /* ------------------------------------------------------------------ */
  function caixaEm(cmds, c, s, cor, e, rot) {
    let M = trM(c);
    if (rot) M = mm(M, rzM(rot));
    cmds.push({ m: "caixa", M: mm(M, scM(s)), c: cor, e: e || 0.05 });
  }
  function cilEm(cmds, a, b, r, cor, e, r2) {
    const d = sub(b, a), bs = basis(d, [1, 0, 0]);
    cmds.push({ m: "cil", M: m4(mul(bs.x, r), d, mul(bs.z, r2 || r), a), c: cor, e: e == null ? 0.2 : e });
  }
  function esfEm(cmds, c, s, cor, e) {
    cmds.push({ m: "esfera", M: mm(trM(c), scM(typeof s === "number" ? [s, s, s] : s)), c: cor, e: e || 0.2 });
  }

  function cadeira(cmds, x0, w, o) {
    o = o || {};
    const sy = 36, hw = 21; // altura do assento, meia largura
    // assento e almofada
    caixaEm(cmds, [x0 + w / 2, sy - 1.5, 0], [w, 4.2, hw * 2], COR.madeira);
    caixaEm(cmds, [x0 + w / 2, sy + 1.4, 0], [w - 3, 2.6, hw * 2 - 3], hex("#b88a5e"), 0.1);
    // pernas
    [[x0 + 3, hw - 3], [x0 + 3, -hw + 3], [x0 + w - 3, hw - 3], [x0 + w - 3, -hw + 3]].forEach((q) =>
      cilEm(cmds, [q[0], 0, q[1]], [q[0], sy - 3, q[1]], 1.9, COR.madeiraEsc, 0.1));
    // encosto
    const alt = o.costas || 58;
    [hw - 3, -hw + 3].forEach((z) => cilEm(cmds, [x0 + 2, sy, z], [x0 + 2, sy + alt, z], 1.9, COR.madeiraEsc, 0.1));
    [0.45, 0.72, 0.97].forEach((f) => caixaEm(cmds, [x0 + 2, sy + alt * f - 5, 0], [2.4, 7, hw * 2 - 4], COR.madeira));
    if (o.bracos) {
      const bx = x0 + w * 0.62;
      [hw + 1.5, -hw - 1.5].forEach((z) => {
        cilEm(cmds, [x0 + 2, sy + 22, z], [bx, sy + 22, z], 1.8, COR.madeiraEsc, 0.1);
        cilEm(cmds, [bx, sy + 1, z], [bx, sy + 22, z], 1.7, COR.madeiraEsc, 0.1);
      });
    }
  }

  function mesa(cmds, x0, x1, topo) {
    caixaEm(cmds, [(x0 + x1) / 2, topo - 3, 0], [x1 - x0, 6, 70], COR.madeira);
    [[x0 + 7, 30], [x0 + 7, -30], [x1 - 7, 30], [x1 - 7, -30]].forEach((q) =>
      cilEm(cmds, [q[0], 0, q[1]], [q[0], topo - 6, q[1]], 2.3, COR.madeiraEsc, 0.1));
  }

  function barrasParalelas(cmds, x0, x1, y, z) {
    x0 = Math.min(x0, CX - 52); // o poste de trás fica longe das pernas
    [z, -z].forEach((zz) => {
      cilEm(cmds, [x0, y, zz], [x1, y, zz], 1.9, COR.madeiraEsc, 0.25);
      cilEm(cmds, [x1 - 3, 0, zz], [x1 - 3, y, zz], 1.9, COR.madeiraEsc, 0.2);
      cilEm(cmds, [x0 + 2, 0, zz], [x0 + 2, y, zz], 1.9, COR.madeiraEsc, 0.2);
    });
  }

  function garrafa(cmds, punho, dir, nivel) {
    // dir: direção do antebraço (unitária); garrafa segura no punho, alinhada ao antebraço
    const a = add(punho, mul(dir, 1.5)), b = add(punho, mul(dir, 20));
    cilEm(cmds, a, b, 3.2, COR.vidro, 0.5);
    cilEm(cmds, a, add(a, mul(dir, 18 * nivel)), 2.95, COR.agua, 0.4);
    cilEm(cmds, b, add(b, mul(dir, 3.2)), 1.7, COR.tampa, 0.3);
  }

  function barra(cmds, c, comp, raioDisco) {
    cilEm(cmds, add(c, [0, 0, -comp / 2 - 6]), add(c, [0, 0, comp / 2 + 6]), 1.15, COR.metalEsc, 0.45);
    [1, -1].forEach((sg) => {
      const z0 = comp / 2 * sg;
      cilEm(cmds, add(c, [0, 0, z0 + sg * 0.6 - 0]), add(c, [0, 0, z0 + sg * 4]), 0, COR.metal, 0); // (placeholder sem efeito)
    });
    const discoCil = (z, r) => {
      const a = [c[0], c[1], z], b = [c[0], c[1], z + (z > 0 ? 3.4 : -3.4)];
      // cilindro com eixo em z: usa base manual
      const d = sub(b, a), bs = basis(d, [1, 0, 0]);
      cmds.push({ m: "cil", M: m4(mul(bs.x, r), d, mul(bs.z, r), a), c: COR.metal, e: 0.5 });
      cmds.push({ m: "cil", M: m4(mul(bs.x, r * 0.5), mul(d, 1.18), mul(bs.z, r * 0.5), a), c: hex("#78909c"), e: 0.6 });
    };
    [1, -1].forEach((sg) => discoCil(sg * (comp / 2 + 1), raioDisco));
  }

  /* ------------------------------------------------------------------ */
  /* cenas                                                                */
  /* ------------------------------------------------------------------ */
  const SENTADO_CAD = (cmds, x0) => cadeira(cmds, x0, 46);

  const CFG = {
    bola: {
      cad: (c) => SENTADO_CAD(c, 126),
      obj(c, d, o) {
        const r = 7.5 - 2.6 * d.pose.k, dir = norm(sub(o.punhoN, o.cotoveloN));
        esfEm(c, add(o.punhoN, add(mul(dir, 6.2), [0, 0, 0])), r, COR.bola, 0.3);
      },
    },
    garrafa: {
      cad: (c) => SENTADO_CAD(c, 126),
      obj(c, d, o) {
        garrafa(c, o.punhoN, norm(sub(o.punhoN, o.cotoveloN)), 0.62);
        garrafa(c, o.punhoF, norm(sub(o.punhoF, o.cotoveloF)), 0.62);
      },
    },
    joelho: {
      cad: (c) => SENTADO_CAD(c, 126),
      obj(c, d, o) {
        const k = o.joelhoN, a = o.tornozeloN;
        const t = 0.78, ctr = add(k, mul(sub(a, k), t)), dir = norm(sub(a, k));
        cilEm(c, add(ctr, mul(dir, -7)), add(ctr, mul(dir, 7)), 6.6, COR.metal, 0.35);
        cilEm(c, add(ctr, mul(dir, -0.4)), add(ctr, mul(dir, 0.4)), 6.9, COR.metalEsc, 0.2);
      },
    },
    cadeiraAjuda: { cad: (c) => cadeira(c, 102, 46), zh: 8.5, ajuda: true },
    cadeiraSozinho: { cad: (c) => cadeira(c, 102, 46, { bracos: true }) },
    sentarImaginario: { cad: (c) => { cadeira(c, 92, 46); mesa(c, 172, 252, 88); }, zh: 8 },
    alongBracosCadeira: { cad: (c) => cadeira(c, 115, 62) },
    toalha: {
      cad: (c) => SENTADO_CAD(c, 126), zh: 5.5,
      obj(c, d, o) {
        const a = add(mul(add(o.punhoN, o.punhoF), 0.5), [5, -1, 0]);
        const k = d.pose.k, N = 9;
        for (let i = 0; i < N; i++) {
          const z0 = -16 + (32 * i) / N, z1 = -16 + (32 * (i + 1)) / N;
          cilEm(c, [a[0], a[1], z0], [a[0], a[1], z1], 3.4, COR.toalha, 0.1);
          const ang = k * 1.4 * ((i + 0.5) / N - 0.5) * 2 * Math.PI * 0.55;
          caixaEm(c, [a[0] + Math.sin(ang) * 3.5, a[1] + Math.cos(ang) * 3.5, (z0 + z1) / 2], [0.8, 0.8, (z1 - z0) * 0.9], COR.toalhaEsc, 0.05);
        }
      },
    },
    alongPernas: { cad: (c) => cadeira(c, 116, 46) },
    caminhar: {},
    caminharA: { zh: 11, obj(c) { barrasParalelas(c, CX + 6, 228, 88, 11); } },
    caminharE: {},
    linha: {
      zl: 1.3,
      obj(c) { caixaEm(c, [150, 0.2, 0], [900, 0.3, 3.2], COR.fita, 0.05); },
    },
    pontasCalcanhares: {
      rotulo: (s) => (s < 0.5 ? "NA PONTA DOS PÉS" : "NOS CALCANHARES"),
    },
    obstaculos: {
      zh: 11,
      obj(c, d) {
        barrasParalelas(c, CX + 6, 228, 90, 11);
        const A = d.A, sc = d.scroll;
        for (let k = -4; k <= 8; k++) {
          const x = CX + 0.8 * A - sc + (k * A) / 2;
          if (x < 20 || x > 330) continue;
          caixaEm(c, [x, 6.5, 0], [8, 13, 30], hex("#f5d36b"), 0.1);
          caixaEm(c, [x, 13.4, 0], [8.4, 1.2, 30.4], COR.fita, 0.1);
        }
      },
    },
    balao: {
      zh: 7,
      obj(c, d, o) {
        const t = Math.abs(Math.sin(2 * Math.PI * d.pose.u));
        const by = 124 + 26 * t, bx = CX + 25 + 8 * Math.sin(2 * Math.PI * d.pose.u);
        const mao = mul(add(o.punhoN, o.punhoF), 0.5);
        esfEm(c, [bx, by, 0], [12, 15, 12], COR.balao, 0.6);
        cilEm(c, [bx, by - 15, 0], add(mao, [1, 2, 0]), 0.22, hex("#999999"), 0.1);
      },
    },
    escadas: { zh: 8, escada: true },
    umaPerna: {},
    alongBracos: {},
    biceps: {
      zh: 9,
      obj(c, d, o) { barra(c, mul(add(o.punhoN, o.punhoF), 0.5), 42, 9); },
    },
    remada: {
      zh: 9,
      obj(c, d, o) { barra(c, mul(add(o.punhoN, o.punhoF), 0.5), 42, 9); },
    },
    agachamento: { zh: 16, barraNoOmbro: true },
    passadas: { zh: 16, barraNoOmbro: true },
    oitos: { oitos: true, T: 16 },
  };

  // câmera inicial de cada exercício, derivada do enquadramento 2D
  function camPadrao(id, d) {
    const vb = d.VB;
    const alt = vb[3] * 1.0;
    const dist = (alt / 2 / Math.tan(rad(FOV / 2))) * 1.2;
    return { tx: vb[0] + vb[2] / 2, ty: G - (vb[1] + vb[3] / 2) - 6, dist, asp: vb[2] / vb[3] };
  }

  /* ------------------------------------------------------------------ */
  /* montagem da cena                                                     */
  /* ------------------------------------------------------------------ */
  function cena3d(id, s) {
    const cfg = CFG[id] || {};
    const cmds = [];
    let d, R = ID(), semPiso = false;
    let scroll = 0;
    const info = { cmds };

    if (cfg.oitos) {
      const gait = F2.dados("caminhar", (s * 11) % 1);
      d = gait;
      const cx = 160, cy = 112, A = 104, B = 96, t = s * 2 * Math.PI;
      const pos = (tt) => [cx + A * Math.cos(tt), cy + (B * Math.sin(2 * tt)) / 2];
      const p = pos(t), dx = -A * Math.sin(t), dy = B * Math.cos(2 * t);
      const th = Math.atan2(-dy, dx);
      R = mm(trM([p[0] - 160, 0, p[1] - 112]), mm(ryM(th), trM([-CX, 0, 0])));
      figura3d(cmds, d.J, { R, zl: 6.5, zh: 10 });
      // percurso e garrafas
      for (let i = 0; i < 70; i++) {
        const tt = (i / 70) * 2 * Math.PI, q = pos(tt), tt2 = ((i + 0.35) / 70) * 2 * Math.PI, q2 = pos(tt2);
        cilEm(cmds, [q[0] - 160, 0.1, q[1] - 112], [q2[0] - 160, 0.1, q2[1] - 112], 0.9, COR.fita, 0.02);
      }
      [-52, 52].forEach((x) => {
        cilEm(cmds, [x, 0, 0], [x, 22, 0], 4.6, COR.vidro, 0.5);
        cilEm(cmds, [x, 0, 0], [x, 13, 0], 4.3, COR.agua, 0.4);
        cilEm(cmds, [x, 22, 0], [x, 25, 0], 2.2, COR.tampa, 0.3);
      });
      info.cam = { tx: 0, ty: 0, dist: 540, asp: 1.4, yaw: 0, pitch: 58 };
      info.floor = true; info.scroll = 0; info.T = cfg.T;
      return info;
    }

    d = F2.dados(id, s);
    scroll = d.scroll;
    const zh = cfg.zh, zl = cfg.zl;

    // objetos de cena (fixos)
    if (cfg.cad) cfg.cad(cmds);

    const o = {};
    const fig = figura3d(cmds, d.J, { zl, zh, R });
    o.punhoN = fig.punhoN; o.punhoF = fig.punhoF;
    const J = d.J;
    o.joelhoN = P3(J.ln.knee, zl == null ? 6.5 : zl); o.tornozeloN = P3(J.ln.ank, zl == null ? 6.5 : zl);
    const zS = 10.4, zH = zh == null ? 9.5 : zh;
    o.cotoveloN = P3(J.an.el, (zS + zH) / 2); o.cotoveloF = P3(J.af.el, -(zS + zH) / 2);

    if (cfg.ajuda && d.H) {
      const Rh = mm(trM([2 * d.helperX, 0, 0]), ryM(Math.PI));
      figura3d(cmds, d.H, { R: Rh, zl: 6.5, zh: 8.5, pal: { camisa: COR.ajuda } });
    }
    if (cfg.barraNoOmbro) {
      const l = rad(J.lean), n = [Math.cos(l), Math.sin(l)], u = [Math.sin(l), -Math.cos(l)];
      const bx = J.sh[0] - 6 * n[0] + 2 * u[0], by = J.sh[1] - 6 * n[1] + 2 * u[1];
      barra(cmds, [bx, G - by, 0], 42, 9);
    }
    if (cfg.obj) cfg.obj(cmds, { pose: d.pose, A: d.A, scroll: d.scroll }, o);

    if (cfg.escada) {
      semPiso = true;
      const R0 = 25, Hs = 15, dx0 = 12.5, d0 = 64;
      const shx = -50 * s, shy = 30 * s, hipY = J.hip[1];
      for (let k = -8; k <= 8; k++) {
        const cx = CX + dx0 + R0 * k + shx, y2 = hipY + d0 - Hs * k + shy, top = G - y2;
        caixaEm(cmds, [cx, top - 80, 0], [R0, 160, 64], COR.pedra, 0.08);
        caixaEm(cmds, [cx, top - 0.6, 0], [R0 - 0.4, 1.2, 64], COR.pedraTopo, 0.1);
      }
      const hx0 = CX + 26, hy0 = G - (J.hip[1] + 0);
      void hy0;
      const base = [hx0, G - (80 + 14), 0];
      [8, -8].forEach((z) => cilEm(cmds, [base[0] - 80, base[1] - 48, z], [base[0] + 120, base[1] + 72, z], 1.9, COR.madeiraEsc, 0.3));
    }
    info.cam = camPadrao(id, d);
    info.floor = !semPiso && d.floor;
    info.scroll = scroll;
    info.T = d.T;
    info.rotulo = cfg.rotulo ? cfg.rotulo(s) : "";
    info.semSombra = semPiso;
    return info;
  }

  /* ------------------------------------------------------------------ */
  /* renderizador WebGL                                                   */
  /* ------------------------------------------------------------------ */
  const VS = `
attribute vec3 aP; attribute vec3 aN;
uniform mat4 uM, uVP; uniform mat3 uN; uniform vec3 uL; uniform float uSh;
varying vec3 vN; varying vec3 vW;
void main(){
  vec4 w = uM*vec4(aP,1.0);
  vN = uN*aN; vW = w.xyz;
  if(uSh>0.5){ w.xyz = w.xyz - uL*(w.y/uL.y); w.y = 0.06; }
  gl_Position = uVP*w;
}`;
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vN; varying vec3 vW;
uniform vec3 uColor, uL, uCam; uniform float uSpec, uSh, uAlpha;
void main(){
  if(uSh>0.5){ gl_FragColor = vec4(0.16,0.11,0.06,uAlpha); return; }
  vec3 n = normalize(vN); vec3 v = normalize(uCam - vW);
  if(dot(n,v)<0.0) n=-n;
  float d = pow(clamp(dot(n,uL)*0.5+0.5,0.0,1.0),1.7);
  float hemi = 0.5+0.5*n.y;
  vec3 amb = mix(vec3(0.62,0.58,0.55), vec3(0.88,0.90,0.94), hemi);
  vec3 c = uColor*(amb*0.62 + vec3(1.0,0.97,0.92)*d*0.66);
  vec3 h = normalize(uL+v);
  float sp = pow(max(dot(n,h),0.0),36.0)*uSpec;
  float rim = pow(1.0-max(dot(n,v),0.0),3.0)*0.10;
  c += vec3(sp) + vec3(rim)*0.8;
  gl_FragColor = vec4(c,1.0);
}`;
  const VSP = `
attribute vec3 aP; uniform mat4 uVP; varying vec3 vW;
void main(){ vW = aP; gl_Position = uVP*vec4(aP,1.0); }`;
  const FSP = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vW; uniform vec3 uCam; uniform float uScroll;
float hs(float x){ return fract(sin(x*12.9898)*43758.5453); }
void main(){
  float pl = 14.0;
  float zi = floor(vW.z/pl), fz = fract(vW.z/pl);
  float xs = vW.x + uScroll;
  float off = hs(zi)*120.0;
  float fx = fract((xs+off)/120.0);
  float xi = floor((xs+off)/120.0);
  vec3 base = mix(vec3(0.80,0.69,0.55), vec3(0.72,0.60,0.46), hs(zi*7.0+xi*3.0));
  float e1 = smoothstep(0.0,0.035,fz)*smoothstep(0.0,0.035,1.0-fz);
  float e2 = smoothstep(0.0,0.012,fx)*smoothstep(0.0,0.012,1.0-fx);
  base *= mix(0.72, 1.0, e1*e2);
  float g = 0.5+0.5*sin(vW.z*3.1+hs(zi)*6.0)*0.0;
  base *= 1.0 - 0.22*smoothstep(0.0,520.0,length(vW.xz-vec2(150.0,0.0)));
  float dist = length(vW.xz-uCam.xz);
  float f = smoothstep(260.0,980.0,dist);
  vec3 bg = vec3(0.93,0.91,0.87);
  gl_FragColor = vec4(mix(base,bg,f),1.0);
}`;

  const FUNDO = [0.93, 0.91, 0.87];

  function criarRenderer(canvas) {
    const gl = canvas.getContext("webgl", { antialias: true, stencil: true, alpha: false, preserveDrawingBuffer: false }) ||
      canvas.getContext("experimental-webgl", { antialias: true, stencil: true, alpha: false });
    if (!gl) return null;
    const prog = (vs, fs) => {
      const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
      return { p, u, aP: gl.getAttribLocation(p, "aP"), aN: gl.getAttribLocation(p, "aN") };
    };
    const L = prog(VS, FS), PF = prog(VSP, FSP);
    const bufs = {};
    const sobe = (nome) => {
      if (bufs[nome]) return bufs[nome];
      const m = MALHAS[nome], v = new Float32Array(m.pos.length * 2);
      for (let i = 0; i < m.pos.length / 3; i++) {
        v.set([m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2], m.nor[i * 3], m.nor[i * 3 + 1], m.nor[i * 3 + 2]], i * 6);
      }
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.idx), gl.STATIC_DRAW);
      return (bufs[nome] = { vb, ib, n: m.idx.length });
    };
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1500, 0, -1500, 1500, 0, -1500, 1500, 0, 1500, -1500, 0, -1500, 1500, 0, 1500, -1500, 0, 1500]), gl.STATIC_DRAW);

    const LUZ = norm([0.38, 1.0, 0.5]);

    function desenha(info, cam, w, h) {
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(FUNDO[0], FUNDO[1], FUNDO[2], 1);
      gl.clearStencil(0);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

      const yaw = rad(cam.yaw), pit = rad(cam.pitch);
      const t = [info.cam.tx, info.cam.ty, 0];
      const dist = info.cam.dist * (cam.zoom || 1);
      const eye = [t[0] + dist * Math.sin(yaw) * Math.cos(pit), t[1] + dist * Math.sin(pit), t[2] + dist * Math.cos(yaw) * Math.cos(pit)];
      const VP = mm(persp(FOV, w / h, 20, 3000), lookAt(eye, t, [0, 1, 0]));

      // piso
      if (info.floor) {
        gl.useProgram(PF.p);
        gl.uniformMatrix4fv(PF.u.uVP, false, VP);
        gl.uniform3fv(PF.u.uCam, eye); gl.uniform1f(PF.u.uScroll, info.scroll || 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.enableVertexAttribArray(PF.aP); gl.vertexAttribPointer(PF.aP, 3, gl.FLOAT, false, 12, 0);
        if (L.aN >= 0) gl.disableVertexAttribArray(L.aN);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      gl.useProgram(L.p);
      gl.uniformMatrix4fv(L.u.uVP, false, VP);
      gl.uniform3fv(L.u.uL, LUZ); gl.uniform3fv(L.u.uCam, eye);
      const normalM = (M) => {
        const o = new Float32Array(9);
        for (let c = 0; c < 3; c++) {
          const x = M[c * 4], y = M[c * 4 + 1], z = M[c * 4 + 2], l2 = x * x + y * y + z * z || 1;
          o[c * 3] = x / l2; o[c * 3 + 1] = y / l2; o[c * 3 + 2] = z / l2;
        }
        return o;
      };
      const bindM = (nome) => {
        const b = sobe(nome);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ib);
        gl.enableVertexAttribArray(L.aP); gl.vertexAttribPointer(L.aP, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(L.aN); gl.vertexAttribPointer(L.aN, 3, gl.FLOAT, false, 24, 12);
        return b;
      };
      // sombras (uma só camada, com stencil para não escurecer duas vezes)
      if (info.floor && !info.semSombra) {
        gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.NOTEQUAL, 1, 255); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.uniform1f(L.u.uSh, 1); gl.uniform1f(L.u.uAlpha, 0.26);
        info.cmds.forEach((c) => {
          if (c.ns || c.y0) return;
          const b = bindM(c.m);
          gl.uniformMatrix4fv(L.u.uM, false, c.M);
          gl.drawElements(gl.TRIANGLES, b.n, gl.UNSIGNED_SHORT, 0);
        });
        gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
      }
      gl.uniform1f(L.u.uSh, 0);
      info.cmds.forEach((c) => {
        const b = bindM(c.m);
        gl.uniformMatrix4fv(L.u.uM, false, c.M);
        gl.uniformMatrix3fv(L.u.uN, false, normalM(c.M));
        gl.uniform3fv(L.u.uColor, c.c); gl.uniform1f(L.u.uSpec, c.e);
        gl.drawElements(gl.TRIANGLES, b.n, gl.UNSIGNED_SHORT, 0);
      });
    }

    function solta() {
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    }
    return { gl, desenha, solta, canvas };
  }

  /* ------------------------------------------------------------------ */
  /* componente da página                                                 */
  /* ------------------------------------------------------------------ */
  let okGL = null;
  function disponivel() {
    if (okGL != null) return okGL;
    try {
      const c = document.createElement("canvas");
      const r = criarRenderer(c);
      okGL = !!r;
      if (r) r.solta();
    } catch (e) { okGL = false; }
    return okGL;
  }

  // exercícios em que o 3D explica melhor (profundidade / movimento lateral); nos demais, o padrão é 2D
  const PADRAO_3D = { oitos: 1, toalha: 1, linha: 1, caminharA: 1, obstaculos: 1, alongBracos: 1 };
  function lerPref(id) {
    try {
      const m = JSON.parse(localStorage.getItem("passofirme.vistas") || "{}");
      if (m[id] === "2d" || m[id] === "3d") return m[id];
    } catch (e) { /* ok */ }
    return PADRAO_3D[id] ? "3d" : "2d";
  }
  function gravaPref(id, v) {
    try {
      const m = JSON.parse(localStorage.getItem("passofirme.vistas") || "{}");
      m[id] = v;
      localStorage.setItem("passofirme.vistas", JSON.stringify(m));
    } catch (e) { /* ok */ }
  }

  const VISTAS = [
    { nome: "Vista 3/4", yaw: 34, pitch: 9 },
    { nome: "Vista de lado", yaw: 0, pitch: 6 },
    { nome: "Vista de frente", yaw: 88, pitch: 6 },
  ];

  const ativos = [];
  let raf = null;
  function laco(ts) {
    raf = null;
    for (let i = ativos.length - 1; i >= 0; i--) {
      if (!ativos[i].canvas.isConnected) { ativos[i].fim(); ativos.splice(i, 1); }
    }
    let alguem = false;
    ativos.forEach((a) => {
      alguem = true;
      if (a.rodando) {
        if (a.ult == null) a.ult = ts;
        const dt = ts - a.ult;
        a.ult = ts;
        a.t += (Math.min(dt, 100) / 1000) * a.vel;
      } else a.ult = null;
      if (a.rodando || a.sujo) a.pinta();
    });
    if (alguem) raf = requestAnimationFrame(laco);
  }

  function montar3d(id, titulo, svgFallback) {
    if (!F2 || !F2.tem(id) || !disponivel()) return null;
    const box = document.createElement("div");
    box.className = "fig fig3";

    const seg = document.createElement("div");
    seg.className = "fig-seg";
    const b3 = document.createElement("button"), b2 = document.createElement("button");
    b3.type = b2.type = "button"; b3.textContent = "3D"; b2.textContent = "2D";
    seg.append(b3, b2);

    const vista3 = document.createElement("div");
    const canvas = document.createElement("canvas");
    canvas.className = "fig-3d";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Animação 3D do exercício: " + (titulo || id));
    const rot = document.createElement("div");
    rot.className = "fig-rot";
    const tela = document.createElement("div");
    tela.className = "fig-tela";
    tela.append(canvas, rot);
    vista3.append(tela);

    const barra = document.createElement("div");
    barra.className = "fig-ctl";
    const bPlay = document.createElement("button"), bVel = document.createElement("button"), bVista = document.createElement("button");
    [bPlay, bVel, bVista].forEach((b) => (b.type = "button"));
    barra.append(bPlay, bVel, bVista);
    vista3.append(barra);

    const vista2 = svgFallback ? svgFallback() : null;
    if (vista2) vista2.style.display = "none";

    box.append(seg, vista3);
    if (vista2) box.append(vista2);

    // estado
    const ini = F2.dados(id, 0);
    const T = (CFG[id] && CFG[id].T) || ini.T;
    const a = { canvas, t: 0, vel: 1, rodando: false, ult: null, sujo: true, ren: null, vista: 0, cam: null, modo3d: true };
    const camInicial = () => {
      const base = cena3d(id, 0.2).cam;
      return base;
    };
    const aplicaVista = (i) => {
      a.vista = i;
      const v = VISTAS[i];
      const c = camInicial();
      a.cam = { yaw: c.yaw != null ? c.yaw + (i === 0 ? 0 : 0) : v.yaw, pitch: c.pitch != null ? c.pitch : v.pitch, zoom: 1 };
      if (c.yaw == null) { a.cam.yaw = v.yaw; a.cam.pitch = v.pitch; }
      else if (i === 1) { a.cam.yaw = 0; a.cam.pitch = 24; }
      else if (i === 2) { a.cam.yaw = 55; a.cam.pitch = 38; }
      bVista.textContent = "Girar vista";
      a.sujo = true;
    };
    aplicaVista(0);

    const rotulos = () => {
      bPlay.textContent = a.rodando ? "Pausar" : "Animar";
      bVel.textContent = a.vel < 1 ? "Normal" : "Devagar";
    };
    rotulos();

    const pos = () => (((a.t / T) % 1) + 1) % 1;
    a.pinta = () => {
      if (!a.modo3d) return;
      const w0 = canvas.clientWidth;
      if (!w0) return;
      if (!a.ren) {
        try { a.ren = criarRenderer(canvas); } catch (e) { a.ren = null; }
        if (!a.ren) return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const info = cena3d(id, pos());
      const asp = info.cam.asp;
      const w = Math.round(w0 * dpr), h = Math.round((w0 / asp) * dpr);
      canvas.style.aspectRatio = asp.toFixed(3);
      a.ren.desenha(info, a.cam, w, h);
      rot.textContent = info.rotulo || "";
      a.sujo = false;
    };
    a.fim = () => { if (a.ren) { a.ren.solta(); a.ren = null; } };
    a.t = (ini.pose && 0.3) * T;

    const garante = () => {
      if (ativos.indexOf(a) < 0) ativos.push(a);
      if (!raf) raf = requestAnimationFrame(laco);
    };
    const liga = () => { a.rodando = true; a.ult = null; rotulos(); garante(); };
    const desliga = () => { a.rodando = false; rotulos(); a.sujo = true; garante(); };
    bPlay.addEventListener("click", () => (a.rodando ? desliga() : liga()));
    bVel.addEventListener("click", () => { a.vel = a.vel < 1 ? 1 : 0.5; rotulos(); });
    bVista.addEventListener("click", () => aplicaVista((a.vista + 1) % VISTAS.length));

    // girar com o dedo / mouse
    let arr = null;
    canvas.style.touchAction = "pan-y";
    canvas.addEventListener("pointerdown", (e) => { arr = { x: e.clientX, y: e.clientY, yaw: a.cam.yaw, pit: a.cam.pitch, mov: false }; });
    canvas.addEventListener("pointermove", (e) => {
      if (!arr) return;
      const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
      if (!arr.mov && Math.abs(dx) < 6) return;
      arr.mov = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      a.cam.yaw = arr.yaw - dx * 0.5;
      a.cam.pitch = Math.max(-4, Math.min(75, arr.pit + dy * 0.25));
      a.sujo = true; garante();
    });
    const solta = () => { arr = null; };
    canvas.addEventListener("pointerup", solta);
    canvas.addEventListener("pointercancel", solta);

    const modo = (tres, grava) => {
      a.modo3d = tres;
      vista3.style.display = tres ? "" : "none";
      if (vista2) vista2.style.display = tres ? "none" : "";
      b3.classList.toggle("sel", tres); b2.classList.toggle("sel", !tres);
      if (vista2 && vista2.fig) { if (tres) vista2.fig.stop(); else if (aberto) vista2.fig.start(); }
      if (tres) { a.sujo = true; garante(); } else desliga();
      if (grava) gravaPref(id, tres ? "3d" : "2d");
    };
    b3.addEventListener("click", () => modo(true, true));
    b2.addEventListener("click", () => modo(false, true));
    if (!vista2) seg.style.display = "none";

    let aberto = false;
    box.fig = {
      start() {
        aberto = true;
        const reduz = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (a.modo3d) { a.sujo = true; if (reduz) garante(); else liga(); }
        else if (vista2 && vista2.fig) vista2.fig.start();
      },
      stop() {
        aberto = false;
        desliga();
        if (vista2 && vista2.fig) vista2.fig.stop();
      },
    };

    modo(lerPref(id) !== "2d" || !vista2, false);
    return box;
  }

  // para testes: desenha um quadro no canvas dado
  function quadro(canvas, id, s, vista, w, h) {
    const r = canvas._r || (canvas._r = criarRenderer(canvas));
    const info = cena3d(id, s);
    const v = vista || {};
    const cam = { yaw: v.yaw != null ? v.yaw : (info.cam.yaw != null ? info.cam.yaw : 34), pitch: v.pitch != null ? v.pitch : (info.cam.pitch != null ? info.cam.pitch : 9), zoom: v.zoom || 1 };
    info.cam.asp = w / h;
    r.desenha(info, cam, w, h);
  }

  root.Figuras3D = {
    disponivel,
    tem: (id) => !!CFG[id],
    montar: montar3d,
    quadro,
    _cena: cena3d,
  };
})(typeof window !== "undefined" ? window : globalThis);
