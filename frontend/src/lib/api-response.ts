import { NextResponse } from 'next/server';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export function unauthorized(message = 'Não autorizado') {
  return NextResponse.json({ message }, { status: 401 });
}

export function forbidden(message = 'Acesso negado') {
  return NextResponse.json({ message }, { status: 403 });
}

export function notFound(message = 'Recurso não encontrado') {
  return NextResponse.json({ message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ message }, { status: 409 });
}

export function serverError(message = 'Erro interno do servidor') {
  return NextResponse.json({ message }, { status: 500 });
}
