import { buildPasswordResetUrl, getPasswordResetFrontendBaseUrl } from "../passwordResetConfig";

describe("passwordResetConfig", () => {
  const originalPasswordResetUrl = process.env.PASSWORD_RESET_FRONTEND_URL;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalAllowed = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    if (originalPasswordResetUrl == null) delete process.env.PASSWORD_RESET_FRONTEND_URL;
    else process.env.PASSWORD_RESET_FRONTEND_URL = originalPasswordResetUrl;
    if (originalFrontendUrl == null) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
    if (originalAllowed == null) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = originalAllowed;
  });

  it("prefers PASSWORD_RESET_FRONTEND_URL", () => {
    process.env.PASSWORD_RESET_FRONTEND_URL = "https://app.example.com/";
    delete process.env.FRONTEND_URL;
    delete process.env.ALLOWED_ORIGINS;

    expect(getPasswordResetFrontendBaseUrl()).toBe("https://app.example.com");
  });

  it("builds reset URL with encoded token", () => {
    process.env.PASSWORD_RESET_FRONTEND_URL = "https://app.example.com";
    const url = buildPasswordResetUrl("ab+c/d");
    expect(url).toBe("https://app.example.com/reset-password?token=ab%2Bc%2Fd");
  });
});
