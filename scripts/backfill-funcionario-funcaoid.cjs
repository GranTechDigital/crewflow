const { PrismaClient } = require("@prisma/client");
const fetch = require("node-fetch");

function normalizeRegime(input) {
  const r = String(input || "ONSHORE").toUpperCase();
  return r.includes("OFFSHORE") ? "OFFSHORE" : "ONSHORE";
}

function normalizeFuncaoText(s) {
  return String(s || "")
    .trim()
    .toUpperCase();
}

function toSlug(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[^A-Za-z0-9\s]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

async function fetchExternalDataWithRetry(maxRetries = 3, timeoutMs = 15000) {
  const url =
    "https://granihcservices145382.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/GS.INT.0005/1/P";
  const headers = {
    Authorization: "Basic SW50ZWdyYS5BZG1pc3NhbzpHckBuIWhjMjAyMg==",
  };
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const externos = await fetchExternalDataWithRetry();
    const externoPorMatricula = new Map();
    for (const item of externos) {
      const matricula = item?.MATRICULA ? String(item.MATRICULA).trim() : "";
      const funcaoTxt = item?.FUNCAO ? normalizeFuncaoText(item.FUNCAO) : "";
      const regime = normalizeRegime(item?.EMPREGADO);
      if (matricula) {
        externoPorMatricula.set(matricula, { funcaoTxt, regime });
      }
    }

    const funcionarios = await prisma.funcionario.findMany({
      select: { id: true, matricula: true, funcao: true, funcaoId: true },
    });

    let atualizados = 0;
    let criadasFuncoes = 0;
    let puladosSemFuncao = 0;
    const erros = [];
    for (const f of funcionarios) {
      if (f.funcaoId) continue;

      const fonte = externoPorMatricula.get(f.matricula) || null;
      const regime = normalizeRegime(fonte?.regime);
      const funcaoTxt = normalizeFuncaoText(fonte?.funcaoTxt || f.funcao || "");
      if (!funcaoTxt) {
        puladosSemFuncao += 1;
        continue;
      }

      try {
        const slug = toSlug(funcaoTxt);
        let funcaoRow = await prisma.funcao.findFirst({
          where: { funcao: funcaoTxt, regime },
        });
        if (!funcaoRow) {
          funcaoRow = await prisma.funcao.findFirst({
            where: { funcao_slug: slug, regime },
          });
        }
        if (!funcaoRow) {
          try {
            funcaoRow = await prisma.funcao.create({
              data: {
                funcao: funcaoTxt,
                regime,
                funcao_slug: slug,
                ativo: true,
              },
            });
            criadasFuncoes += 1;
          } catch (createErr) {
            // Se falhar por unique em (funcao_slug, regime), tentar recuperar existente por slug
            const msg = createErr?.message || String(createErr);
            if (
              msg.includes("Unique constraint failed") ||
              msg.includes("unique")
            ) {
              funcaoRow = await prisma.funcao.findFirst({
                where: { funcao_slug: slug, regime },
              });
            }
            if (!funcaoRow) throw createErr;
          }
        }

        await prisma.funcionario.update({
          where: { id: f.id },
          data: { funcaoId: funcaoRow.id },
        });
        atualizados += 1;
      } catch (e) {
        erros.push({
          matricula: f.matricula,
          motivo: e?.message || String(e),
        });
      }
    }

    console.log("Resumo Backfill Funcionario.funcaoId:");
    console.log(
      JSON.stringify(
        {
          total: funcionarios.length,
          atualizados,
          puladosSemFuncao,
          criadasFuncoes,
          errosCount: erros.length,
          exemplosErros: erros.slice(0, 10),
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error("Erro no backfill:", err?.message || err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
