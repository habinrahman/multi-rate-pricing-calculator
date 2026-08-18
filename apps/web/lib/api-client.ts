import type {
  ApiError,
  CalculatedLineItem,
  DocumentStatus,
  DocumentTotals,
  LineItemInput,
  ReportSummary,
} from '@multi-rate/shared';
import { environment } from './env';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Document {
  _id: string;
  ownerId: string;
  title: string;
  customer: string;
  issueDate: string;
  status: DocumentStatus;
  lineItems: CalculatedLineItem[];
  totals: DocumentTotals;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
}

export interface DocumentCreateInput {
  title: string;
  customer: string;
  issueDate: string;
  lineItems: LineItemInput[];
}

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const TOKEN_STORAGE_KEY = 'mrc_auth_token';

export class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
    }
  }

  setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
    }
    return this.token;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(init.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    if (init.body && typeof init.body === 'string' && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(`${environment.apiUrl}${path}`, {
      ...init,
      headers,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = (await response.json().catch(() => null)) as
      (T & { error?: ApiError['error'] }) | null;

    if (!response.ok) {
      const err = (payload as unknown as ApiError)?.error;
      throw new ApiClientError(
        err?.code ?? `HTTP_${response.status}`,
        err?.message ?? 'Request failed.',
        err?.details,
      );
    }

    return payload as T;
  }

  // Auth Endpoints
  async signup(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async logout(): Promise<void> {
    try {
      if (this.getToken()) {
        await this.request<void>('/auth/logout', { method: 'POST' });
      }
    } finally {
      this.setToken(null);
    }
  }

  async getMe(): Promise<User> {
    const res = await this.request<{ user: User }>('/auth/me', { method: 'GET' });
    return res.user;
  }

  // Document Endpoints
  async getDocuments(): Promise<Document[]> {
    const res = await this.request<{ documents: Document[] }>('/documents', { method: 'GET' });
    return res.documents;
  }

  async getDocument(id: string): Promise<Document> {
    const res = await this.request<{ document: Document }>(`/documents/${id}`, { method: 'GET' });
    return res.document;
  }

  async createDocument(data: DocumentCreateInput): Promise<Document> {
    const res = await this.request<{ document: Document }>('/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.document;
  }

  async updateDocument(id: string, data: DocumentCreateInput): Promise<Document> {
    const res = await this.request<{ document: Document }>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.document;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.request<void>(`/documents/${id}`, { method: 'DELETE' });
  }

  async finalizeDocument(id: string): Promise<Document> {
    const res = await this.request<{ document: Document }>(`/documents/${id}/finalize`, {
      method: 'POST',
    });
    return res.document;
  }

  // Reports
  async getReportSummary(startDate: string, endDate: string): Promise<ReportSummary> {
    const params = new URLSearchParams({ startDate, endDate });
    const res = await this.request<{ report: ReportSummary }>(
      `/reports/summary?${params.toString()}`,
      { method: 'GET' },
    );
    return res.report;
  }
}

export const apiClient = new ApiClient();
