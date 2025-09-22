import { NextRequest, NextResponse } from "next/server";
import { getProgress, removeProgress } from "../progressManager";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get('uploadId');

  if (!uploadId) {
    return NextResponse.json({ error: 'Upload ID é obrigatório' }, { status: 400 });
  }

  // Configurar SSE
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;
      
      const sendProgress = () => {
        if (isClosed) return;
        
        const progress = getProgress(uploadId);
        
        if (progress) {
          try {
            const data = `data: ${JSON.stringify(progress)}\n\n`;
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            // Controller já foi fechado
            isClosed = true;
            return;
          }
          
          // Se completado ou com erro, limpar e fechar
          if (progress.completed || progress.error) {
            setTimeout(() => {
              if (!isClosed) {
                removeProgress(uploadId);
                try {
                  controller.close();
                  isClosed = true;
                } catch (error) {
                  // Controller já foi fechado
                  isClosed = true;
                }
              }
            }, 1000);
            return;
          }
        }
        
        // Verificar novamente em 500ms se não foi fechado
        if (!isClosed) {
          setTimeout(sendProgress, 500);
        }
      };
      
      // Enviar cabeçalho SSE
      try {
        controller.enqueue(encoder.encode('data: {"stage":"waiting","message":"Aguardando início do upload..."}\n\n'));
      } catch (error) {
        isClosed = true;
        return;
      }
      
      // Iniciar verificação de progresso
      setTimeout(sendProgress, 500);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}