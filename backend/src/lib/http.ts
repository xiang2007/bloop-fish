// Small HTTP helpers shared by the routes.

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404,
    message: string,
  ) {
    super(message);
  }
}

// The submitted fields, readable the way `FormData` was: get / getAll.
// The web app sends JSON (or multipart for the CSV import); both end up here.
export class Fields {
  constructor(private data: Record<string, unknown>) {}

  get(name: string): string | null {
    const value = this.data[name];
    const first = Array.isArray(value) ? value[0] : value;
    return first === undefined || first === null ? null : String(first);
  }

  getAll(name: string): string[] {
    const value = this.data[name];
    if (value === undefined || value === null) return [];
    return (Array.isArray(value) ? value : [value]).map(String);
  }
}
