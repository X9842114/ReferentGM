import { handlePostgrest } from "@/lib/postgrest-local";

type Ctx = { params: Promise<{ table: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { table } = await ctx.params;
  return handlePostgrest(request, table);
}

export async function HEAD(request: Request, ctx: Ctx) {
  const { table } = await ctx.params;
  return handlePostgrest(request, table);
}

export async function POST(request: Request, ctx: Ctx) {
  const { table } = await ctx.params;
  return handlePostgrest(request, table);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { table } = await ctx.params;
  return handlePostgrest(request, table);
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { table } = await ctx.params;
  return handlePostgrest(request, table);
}
