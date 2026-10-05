// Shape of the API's answer to a form submission. Validation problems come
// back as `status: "error"` with a message and optional per-field errors.
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

// A successful write that should send the user somewhere else.
export type Redirect = { redirect: string };

export type ActionResult = FormState | Redirect;
