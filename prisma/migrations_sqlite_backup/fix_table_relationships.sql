-- Fix table relationships for proper N:M structure

-- 1. Remove statusGeral from Status table
ALTER TABLE Status DROP COLUMN statusGeral;

-- 2. Fix StatusMapping table structure
-- Remove categoria column and add statusId reference
ALTER TABLE StatusMapping DROP COLUMN categoria;
ALTER TABLE StatusMapping ADD COLUMN statusId INTEGER REFERENCES Status(id);

-- 3. Clean up CentroCustoProjeto table (keep as intermediary table)
-- Remove redundant columns, keep only necessary ones for N:M relationship
ALTER TABLE CentroCustoProjeto DROP COLUMN ccProjeto;
ALTER TABLE CentroCustoProjeto DROP COLUMN nomeCc;
ALTER TABLE CentroCustoProjeto DROP COLUMN ccNome;
ALTER TABLE CentroCustoProjeto DROP COLUMN projeto;
ALTER TABLE CentroCustoProjeto DROP COLUMN grupo1;
ALTER TABLE CentroCustoProjeto DROP COLUMN grupo2;

-- Rename cc to centroCusto for clarity
ALTER TABLE CentroCustoProjeto RENAME COLUMN cc TO centroCusto;

-- 4. Clean up Projeto table (remove redundant grouping columns)
ALTER TABLE Projeto DROP COLUMN grupo1;
ALTER TABLE Projeto DROP COLUMN grupo2;