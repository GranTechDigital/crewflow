-- AlterTable
ALTER TABLE "UptimeUpload" ADD COLUMN "dataRelatorio" DATETIME;

-- CreateIndex
CREATE INDEX "UptimeUpload_dataRelatorio_idx" ON "UptimeUpload"("dataRelatorio");
