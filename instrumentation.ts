export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { enviarRelatorio } = await import("./lib/email");
    enviarRelatorio().catch((e) => console.error("[relatório] Erro ao enviar:", e));
  }
}
