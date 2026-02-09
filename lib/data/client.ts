export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestMessages = {
  errorMessage?: string;
  unauthorizedMessage?: string;
  forbiddenMessage?: string;
};

const extractErrorMessage = async (
  response: Response,
  fallback: string
): Promise<string> => {
  try {
    const data = await response.json();
    if (data && typeof data.error === 'string') {
      return data.error;
    }
  } catch {
    // ignore parse errors
  }
  return fallback;
};

export const requestJson = async <T>(
  input: RequestInfo,
  init?: RequestInit,
  messages: RequestMessages = {}
): Promise<T> => {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  });

  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let fallback = messages.errorMessage ?? 'Request failed.';
  if (response.status === 401 && messages.unauthorizedMessage) {
    fallback = messages.unauthorizedMessage;
  }
  if (response.status === 403 && messages.forbiddenMessage) {
    fallback = messages.forbiddenMessage;
  }

  const message = await extractErrorMessage(response, fallback);
  throw new ApiError(message, response.status);
};

export const requestBlob = async (
  input: RequestInfo,
  init?: RequestInit,
  messages: RequestMessages = {}
): Promise<Blob> => {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
  });

  if (response.ok) {
    return response.blob();
  }

  let fallback = messages.errorMessage ?? 'Request failed.';
  if (response.status === 401 && messages.unauthorizedMessage) {
    fallback = messages.unauthorizedMessage;
  }
  if (response.status === 403 && messages.forbiddenMessage) {
    fallback = messages.forbiddenMessage;
  }

  const message = await extractErrorMessage(response, fallback);
  throw new ApiError(message, response.status);
};
