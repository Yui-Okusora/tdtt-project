/**
 * Sign-up validation: errors are deferred until blur, or until a submitted form is invalid.
 * Never show red/cross while a new field is actively being typed in.
 * Server remains the authority for account uniqueness and registration.
 */
const INPUTS = [
  "signupUsername",
  "signupEmail",
  "signupPassword",
  "signupConfirm",
];
const RULES = {
  username: {
    field: "signupUsername",
    label: "Tên đăng nhập 3–30 ký tự (chữ, số, _, ., -)",
    error: "Tên đăng nhập phải gồm 3–30 ký tự; chỉ dùng chữ, số, _, . hoặc -.",
  },
  email: {
    field: "signupEmail",
    label: "Email đúng định dạng",
    error: "Vui lòng nhập địa chỉ email hợp lệ.",
  },
  length: {
    field: "signupPassword",
    label: "Mật khẩu ít nhất 8 ký tự",
    error: "Mật khẩu cần ít nhất 8 ký tự.",
  },
  uppercase: {
    field: "signupPassword",
    label: "Có ít nhất 1 chữ viết hoa (A–Z)",
    error: "Mật khẩu cần ít nhất một chữ hoa A–Z.",
  },
  confirm: {
    field: "signupConfirm",
    label: "Nhập lại mật khẩu trùng khớp",
    error: "Mật khẩu xác nhận phải trùng với mật khẩu đã tạo.",
  },
};
export function createSignupValidation(doc = document) {
  const touched = new Set();
  const get = (id) => doc.getElementById(id);
  function compute() {
    const name = get("signupUsername").value.trim();
    const email = get("signupEmail").value.trim();
    const pwd = get("signupPassword").value,
      confirm = get("signupConfirm").value;
    return {
      username: /^[\p{L}\p{N}_.-]{3,30}$/u.test(name),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      confirm: confirm.length > 0 && confirm === pwd,
    };
  }
  function render() {
    const checks = compute();
    for (const [key, rule] of Object.entries(RULES)) {
      const active = touched.has(rule.field),
        ok = checks[key];
      const row = doc.querySelector(`[data-signup-rule="${key}"]`);
      row.textContent = `${!active ? "○ " : ok ? "✓ " : "✕ "}${rule.label}`;
      row.classList.toggle("is-valid", active && ok);
      row.classList.toggle("is-invalid", active && !ok);
    }
    for (const id of INPUTS) {
      const input = get(id),
        active = touched.has(id);
      const failed = Object.entries(RULES)
        .filter(([key, rule]) => rule.field === id && !checks[key])
        .map(([, rule]) => rule.error);
      const invalid = active && failed.length > 0;
      input.classList.toggle("signup-invalid", invalid);
      if (active) input.setAttribute("aria-invalid", String(invalid));
      else input.removeAttribute("aria-invalid");
      const feedback = get(`${id}Error`);
      feedback.hidden = !invalid;
      feedback.textContent = invalid ? failed.join(" ") : "";
    }
    return Object.values(checks).every(Boolean);
  }
  for (const id of INPUTS) {
    const input = get(id);
    input.addEventListener("blur", () => {
      touched.add(id);
      render();
    });
    input.addEventListener("input", () => {
      touched.delete(id);
      render();
    });
  }
  return {
    update: render,
    validateAll() {
      for (const id of INPUTS) touched.add(id);
      const valid = render();
      if (!valid) {
        const first = INPUTS.find(
          (id) => get(id).getAttribute("aria-invalid") === "true",
        );
        get(first)?.focus();
      }
      return valid;
    },
    reset() {
      touched.clear();
      render();
    },
  };
}
