import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUserFromRequest } from "@/utils/authUtils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Token de autenticação necessário" },
      { status: 401 }
    );
  }

  const { filename } = await params;
  const safeFilename = path.basename(decodeURIComponent(filename || ""));

  if (!safeFilename || !safeFilename.endsWith(".xlsx")) {
    return NextResponse.json(
      { success: false, error: "Arquivo inválido" },
      { status: 400 }
    );
  }

  const reportsDir = path.resolve(process.cwd(), "public", "import-reports");
  const filePath = path.join(reportsDir, safeFilename);

  if (!filePath.startsWith(reportsDir + path.sep) || !fs.existsSync(filePath)) {
    return NextResponse.json(
      { success: false, error: "Arquivo não encontrado" },
      { status: 404 }
    );
  }

  const file = fs.readFileSync(filePath);

  return new NextResponse(file, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${safeFilename}"`,
      "cache-control": "no-store",
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
