ALTER TABLE "DrakeDocumentoEntrega" DROP CONSTRAINT "DrakeDocumentoEntrega_ambiente_check";
ALTER TABLE "DrakeDocumentoEntrega" ADD CONSTRAINT "DrakeDocumentoEntrega_ambiente_check" CHECK (ambiente IN ('hmg','prd'));
