export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export function methodNotAllowed() {
  return errorResponse("Method not allowed", 405);
}
