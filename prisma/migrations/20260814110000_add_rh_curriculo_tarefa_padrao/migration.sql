INSERT INTO "public"."TarefaPadrao" (
    "setor",
    "tipo",
    "descricao",
    "ativo",
    "createdAt",
    "updatedAt"
)
SELECT
    'RH',
    'Currículo',
    'Currículo',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM "public"."TarefaPadrao"
    WHERE "setor" = 'RH'
      AND upper(translate("tipo", 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')) = 'CURRICULO'
);
