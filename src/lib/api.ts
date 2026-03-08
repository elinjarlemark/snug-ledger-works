// src/lib/api.ts

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit & { json?: any } = {}
): Promise<T> {
  const url =
    API_BASE +
    (path.startsWith('/') ? '' : '/') +
    path;

  const headers: Record<string, string> = {
    ...(options.headers as any),
  };

  let body = options.body;

  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  const data: any = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => '');

  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && (data.detail || data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      ('Request failed (' + res.status + ')');
    throw new Error(String(msg));
  }

  return data as T;
}

export const api = {
  get: <T = any>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T = any>(path: string, json?: any) => apiRequest<T>(path, { method: 'POST', json }),
  put: <T = any>(path: string, json?: any) => apiRequest<T>(path, { method: 'PUT', json }),
  del: <T = any>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

// ---- Auth ----
export async function login(email: string, password: string) {
  return api.post('/auth/login', { email, password });
}

// ---- Companies ----
export async function listCompanies(userId: number) {
  return api.get('/companies?user_id=' + userId);
}

// lock / unlock (backend verkar redan stödja detta)
export async function lockCompany(companyId: number | string, userId: number | string) {
  return api.post('/companies/' + companyId + '/lock', { user_id: Number(userId) });
}

// takeover (lock)
export async function createTakeoverRequest(companyId: number | string, userId: number | string) {
  return api.post('/companies/' + companyId + '/takeover-request', {
    user_id: Number(userId),
  });
}

export async function unlockCompany(companyId: number | string, userId: number | string) {
  return api.post('/companies/' + companyId + '/unlock', { user_id: Number(userId) });
}

// ---- Companies: create / join / members / requests ----

export async function createCompany(
  userId: number | string,
  company: {
    companyName: string;
    organizationNumber: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
    vatNumber?: string;
    fiscalYearStart?: string;
    fiscalYearEnd?: string;
    accountingStandard?: 'K2' | 'K3' | '';
  }
) {
  const body = {
    user_id: Number(userId),
    company_name: company.companyName,
    organization_number: company.organizationNumber,
    address: company.address,
    postal_code: company.postalCode,
    city: company.city,
    country: company.country,
    vat_number: company.vatNumber || null,
    fiscal_year_start: company.fiscalYearStart || null,
    fiscal_year_end: company.fiscalYearEnd || null,
    accounting_standard: company.accountingStandard || null,
  };

  return api.post('/companies', body);
}

export async function joinCompanyByOrgNumber(userId: number | string, organizationNumber: string) {
  return api.post('/companies/join-by-orgnr', {
    user_id: Number(userId),
    organization_number: organizationNumber,
  });
}

export async function approveJoinRequest(
  companyId: number | string,
  adminUserId: number | string,
  memberUserId: number | string
) {
  return api.post('/companies/' + companyId + '/join-requests/' + Number(memberUserId) + '/approve', {
    user_id: Number(adminUserId),
  });
}

export async function removeMember(
  companyId: number | string,
  adminUserId: number | string,
  memberUserId: number | string
) {
  return api.del(
    '/companies/' + companyId + '/members/' + Number(memberUserId) + '?user_id=' + Number(adminUserId)
  );
}

export async function deleteCompany(companyId: number | string, userId: number | string) {
  return api.del('/companies/' + companyId + '?user_id=' + Number(userId));
}

// ---- Join requests ----

export async function createJoinRequest(userId: number | string, organizationNumber: string) {
  return api.post('/companies/join-requests', {
    user_id: Number(userId),
    organization_number: organizationNumber,
  });
}

export async function listJoinRequests(companyId: number | string, userId: number | string) {
  return api.get('/companies/' + companyId + '/join-requests?user_id=' + Number(userId));
}

export async function decideJoinRequest(
  requestId: number | string,
  userId: number | string,
  action: 'approve' | 'reject'
) {
  return api.post('/companies/join-requests/' + requestId + '/decide', {
    user_id: Number(userId),
    action: action,
  });
}

// ---- Lock heartbeat ----
export async function lockHeartbeat(companyId: number | string, userId: number | string) {
  return api.post('/companies/' + companyId + '/lock/heartbeat', { user_id: Number(userId) });
}

// ---- SIE state ----
export async function getSieState(companyId: number | string, userId: number | string) {
  return api.get('/companies/' + companyId + '/sie-state?user_id=' + Number(userId));
}

export async function putSieState(companyId: number | string, userId: number | string, sieContent: string) {
  return api.put('/companies/' + companyId + '/sie-state', { user_id: Number(userId), sie_content: sieContent });
}