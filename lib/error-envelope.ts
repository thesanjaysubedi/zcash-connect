import { NextResponse } from 'next/server';

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export function apiError(status: number, code: string, message: string, field?: string) {
  const body: { error: ApiError } = { error: { code, message } };
  if (field) body.error.field = field;
  return NextResponse.json(body, { status });
}
